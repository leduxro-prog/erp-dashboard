export * from './users-module';
export * from './domain/entities/UserEntity';
export * from './application/services/UserService';
export * from './api/controllers/UserController';

import { UsersModule } from './users-module';
const usersModule = new UsersModule();
export default usersModule;
