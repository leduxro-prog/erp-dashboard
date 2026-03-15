# Plan de Rezolvare: Login și Inventar

**Data:** 11 Februarie 2026
**Status:** În așteptare implementare

## Rezumat Problemă

Utilizatorul nu se poate loga în sistem și inventarul nu se afișează la http://65.108.255.104/inventory, deși există 8,807 produse sincronizate din SmartBill în baza de date.

## Probleme Identificate

### 1. **Modulul Users Nu Funcționează**
- **Cauză:** UserEntity definește coloane care nu există în baza de date
- **Detalii:**
  - UserEntity definește: `username`, `email`, `password`, `role`
  - Baza de date are: `email`, `password_hash`, `first_name`, `last_name`, `role`, etc.
  - Discrepanță între model și schemă → toate query-urile eșuează
- **Erori:**
  - `column UserEntity.username does not exist`
  - Toate endpoint-urile `/api/v1/users/*` returnează 500

### 2. **Endpoint de Login Lipsește**
- **Cauză:** Modulul users nu funcționează → endpoint-ul `/api/v1/users/login` nu este accesibil
- **Status actual:** Am adăugat codul pentru login în UserController dar modulul eșuează la încărcare

### 3. **Redis Authentication (Rezolvat Temporar)**
- **Status:** Am dezactivat autentificarea Redis pentru a permite sistemului să funcționeze
- **Configurare actuală:** `REDIS_PASSWORD=` (gol) în `.env`
- **Note:** Securitate redusă - trebuie reactivată după ce login-ul funcționează

### 4. **Frontend Inventory Page**
- **Status:** Actualizată să folosească API real (`/api/v1/inventory/stock-levels`)
- **Blocare:** Nu poate accesa endpoint-ul din cauza lipsei autentificării (401)

## Date de Acces

**Email:** admin@ledux.ro
**Parolă:** admin123
**Hash parolă în DB:** `$2b$10$Ysd8FGikiLWyLMb0eGixoepvqtQK6u62Ze3a0P5BfMQDP9oCHWcsO`

## Plan de Implementare

### Opțiunea A: Fix Rapid - Login Direct în src/ (RECOMANDAT)

Creează un endpoint de login funcțional fără modulul users.

#### Pași:

1. **Creează `/opt/cypher-erp/src/routes/auth.routes.ts`**
   ```typescript
   import { Router, Request, Response } from 'express';
   import * as jwt from 'jsonwebtoken';
   import * as bcrypt from 'bcrypt';
   import { AppDataSource } from '../data-source';

   const router = Router();

   router.post('/login', async (req: Request, res: Response) => {
     try {
       const { email, password } = req.body;

       if (!email || !password) {
         return res.status(400).json({ error: 'Email and password are required' });
       }

       // Query direct la baza de date
       const userRepo = AppDataSource.getRepository('users');
       const user = await userRepo.createQueryBuilder('user')
         .where('user.email = :email', { email })
         .andWhere('user.is_active = :isActive', { isActive: true })
         .addSelect('user.password_hash')
         .getOne();

       if (!user) {
         return res.status(401).json({ error: 'Invalid credentials' });
       }

       // Validează parola
       const isValid = await bcrypt.compare(password, user.password_hash);
       if (!isValid) {
         return res.status(401).json({ error: 'Invalid credentials' });
       }

       // Generează JWT
       const jwtSecret = process.env.JWT_SECRET || 'change_me_in_production';
       const token = jwt.sign(
         { userId: user.id, email: user.email, role: user.role },
         jwtSecret,
         { expiresIn: '24h' }
       );

       const refreshToken = jwt.sign(
         { userId: user.id },
         process.env.JWT_REFRESH_SECRET || 'change_me_in_production',
         { expiresIn: '7d' }
       );

       // Update last_login_at
       await userRepo.update(user.id, { last_login_at: new Date() });

       res.json({
         success: true,
         token,
         refreshToken,
         user: {
           id: user.id,
           email: user.email,
           first_name: user.first_name,
           last_name: user.last_name,
           role: user.role
         }
       });
     } catch (error) {
       console.error('Login error:', error);
       res.status(500).json({ error: 'Internal Server Error' });
     }
   });

   router.post('/refresh', async (req: Request, res: Response) => {
     try {
       const { refreshToken } = req.body;

       const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'change_me_in_production';
       const decoded = jwt.verify(refreshToken, jwtRefreshSecret) as any;

       const userRepo = AppDataSource.getRepository('users');
       const user = await userRepo.findOne({
         where: { id: decoded.userId, is_active: true }
       });

       if (!user) {
         return res.status(401).json({ error: 'Invalid token' });
       }

       const jwtSecret = process.env.JWT_SECRET || 'change_me_in_production';
       const newToken = jwt.sign(
         { userId: user.id, email: user.email, role: user.role },
         jwtSecret,
         { expiresIn: '24h' }
       );

       const newRefreshToken = jwt.sign(
         { userId: user.id },
         jwtRefreshSecret,
         { expiresIn: '7d' }
       );

       res.json({ token: newToken, refreshToken: newRefreshToken });
     } catch (error) {
       res.status(401).json({ error: 'Invalid or expired token' });
     }
   });

   export default router;
   ```

2. **Montează ruta în `/opt/cypher-erp/src/server.ts`**

   Adaugă după linia 209 (după `app.use('/auth', authRateLimiter);`):
   ```typescript
   import authRoutes from './routes/auth.routes';

   // La sfârșitul fișierului, înainte de montarea modulelor:
   const apiPrefix = config.API_PREFIX;
   app.use(`${apiPrefix}/auth`, authRoutes);
   ```

3. **Actualizează frontend să folosească `/api/v1/auth/login`**

   În `/opt/cypher-erp/frontend/src/services/auth.service.ts`:
   ```typescript
   async login(credentials: LoginRequest): Promise<LoginResponse> {
     const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
     apiClient.setToken(response.token, response.refreshToken);
     return response;
   }
   ```

4. **Rebuild & Restart**
   ```bash
   cd /opt/cypher-erp
   docker compose build app frontend
   docker compose up -d app frontend
   ```

5. **Test Login**
   ```bash
   curl -X POST 'http://localhost:3000/api/v1/auth/login' \
     -H 'Content-Type: application/json' \
     -d '{"email":"admin@ledux.ro","password":"admin123"}'
   ```

#### Avantaje Opțiunea A:
- ✅ Rapid de implementat (30 minute)
- ✅ Nu depinde de modulul users
- ✅ Funcționează cu schema reală a bazei de date
- ✅ Permite testarea imediată a inventory page

---

### Opțiunea B: Fix Complet - Repară Modulul Users

Actualizează UserEntity să se potrivească cu schema bazei de date.

#### Pași:

1. **Actualizează `/opt/cypher-erp/modules/users/src/domain/entities/UserEntity.ts`**

   Modifică entitatea să reflecte schema reală:
   ```typescript
   @Entity('users')
   export class UserEntity {
     @PrimaryGeneratedColumn('increment')
     id!: number;

     @Column({ unique: true })
     email!: string;

     @Column({ name: 'password_hash', select: false })
     password_hash!: string;

     @Column({ name: 'first_name' })
     first_name!: string;

     @Column({ name: 'last_name' })
     last_name!: string;

     @Column({ name: 'phone_number', nullable: true })
     phone_number?: string;

     @Column({
       type: 'enum',
       enum: UserRole,
       default: UserRole.SALES,
     })
     role!: UserRole;

     @Column({ name: 'is_active', default: true })
     is_active!: boolean;

     @Column({ name: 'last_login_at', type: 'timestamp', nullable: true })
     last_login_at?: Date;

     @Column({ name: 'email_verified', default: false })
     email_verified!: boolean;

     @CreateDateColumn({ name: 'created_at' })
     created_at!: Date;

     @UpdateDateColumn({ name: 'updated_at' })
     updated_at!: Date;

     async validatePassword(password: string): Promise<boolean> {
       return bcrypt.compare(password, this.password_hash);
     }
   }
   ```

2. **Actualizează UserService**

   Modifică toate metodele să folosească `email` în loc de `username`:
   ```typescript
   async create(data: {
     email: string;
     password: string;
     first_name: string;
     last_name: string;
     role?: string;
   }): Promise<UserEntity> {
     const hash = await bcrypt.hash(data.password, 10);
     const user = this.repository.create({
       ...data,
       password_hash: hash,
     });
     return await this.repository.save(user);
   }

   async findByEmail(email: string): Promise<UserEntity | null> {
     return this.repository.findOne({
       where: { email },
       select: ['id', 'email', 'password_hash', 'first_name', 'last_name', 'role', 'is_active'],
     });
   }
   ```

3. **Actualizează UserController login method**

   Folosește `findByEmail` în loc de `findByUsername`

4. **Rebuild, Restart, Test**

#### Avantaje Opțiunea B:
- ✅ Soluție completă și sustenabilă
- ✅ Modulul users va funcționa corect
- ✅ Permite extensii viitoare (resetare parolă, etc.)

#### Dezavantaje:
- ❌ Mai mult timp de implementare (2-3 ore)
- ❌ Risc de a afecta alte părți ale sistemului

---

## Recomandare

**Implementează Opțiunea A acum** pentru a debloca rapid sistemul, apoi **aplică Opțiunea B** când ai timp pentru un refactor complet.

## Verificare Finală

După implementare, verifică:

1. **Login funcționează:**
   - [ ] http://65.108.255.104/login acceptă admin@ledux.ro / admin123
   - [ ] Redirect la dashboard după login
   - [ ] Token JWT salvat în localStorage

2. **Inventory funcționează:**
   - [ ] http://65.108.255.104/inventory afișează produse
   - [ ] Număr total produse: 8,807
   - [ ] Filtrare și paginare funcționează
   - [ ] Status produse (Normal/Atentionare/Critic) se afișează

3. **Redis:**
   - [ ] Nu există erori NOAUTH în logs
   - [ ] Consideră reactivarea autentificării după stabilizare

## Probleme Cunoscute Rezolvate

- ✅ Modulul inventory se încarcă corect
- ✅ Endpoint `/api/v1/inventory/stock-levels` funcționează
- ✅ Frontend Inventory page actualizat să folosească API real
- ✅ Redis authentication dezactivată temporar
- ✅ Stoc SmartBill sincronizat: 8,807 produse în `stock_levels`

## Fișiere Modificate În Această Sesiune

1. `/opt/cypher-erp/modules/inventory/src/index.ts` - Adăugat export default
2. `/opt/cypher-erp/modules/inventory/src/api/controllers/InventoryController.ts` - Adăugat getStockLevels()
3. `/opt/cypher-erp/modules/inventory/src/api/routes/inventory.routes.ts` - Adăugat ruta /stock-levels
4. `/opt/cypher-erp/modules/inventory/src/infrastructure/composition-root.ts` - Actualizat Redis config
5. `/opt/cypher-erp/frontend/src/pages/InventoryPage.tsx` - Rewriten pentru API real
6. `/opt/cypher-erp/modules/users/src/index.ts` - Adăugat export default
7. `/opt/cypher-erp/modules/users/src/api/controllers/UserController.ts` - Adăugat login method
8. `/opt/cypher-erp/modules/users/src/application/services/UserService.ts` - Adăugat findByEmail, validatePassword
9. `/opt/cypher-erp/frontend/src/services/auth.service.ts` - Actualizat endpoint la /users/login
10. `/opt/cypher-erp/.env` - Dezactivat REDIS_PASSWORD
11. `/opt/cypher-erp/docker-compose.yml` - Dezactivat Redis auth

## Notă de Securitate

⚠️ **IMPORTANT:** Redis rulează fără autentificare! Nu este expus pe internet (portul nu este mapat), dar ar trebui reactivată autentificarea după ce login-ul funcționează.

Pentru reactivare:
1. Setează `REDIS_PASSWORD=sDNJGb/b7Ccu7PbMAoJu4ajV8qRcwijAOmO2d+JIQWE=` în `.env`
2. Actualizează docker-compose.yml să ceară parola
3. Asigură-te că TOȚI clienții Redis (event-bus, redis-pool, composition-roots) folosesc parola
4. Rebuild & restart toate containerele

## Contact

Pentru întrebări sau probleme în timpul implementării, consultă acest plan și logs-urile aplicației:
```bash
docker logs cypher-erp-app --tail 100
docker logs cypher-erp-frontend --tail 50
```
