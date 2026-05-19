type ReplacementRule = readonly [RegExp, string];

const PHRASE_REPLACEMENTS: ReplacementRule[] = [
  [/\bpower\s+supply\b/gi, 'sursa de alimentare'],
  [/\bfuente\s+de\s+alimentacion\b/gi, 'sursa de alimentare'],
  [/\bsursa\s+de\s+alimentare\b/gi, 'sursa de alimentare'],
  [/\bzasilacz\s+din\b/gi, 'sursa de alimentare pe sina DIN'],
  [/\bdin\s+rail\b/gi, 'sina DIN'],
  [/\bschiene\s+din\b/gi, 'sina DIN'],
  [/\bsu\s+guida\s+din\b/gi, 'pe sina DIN'],
  [/\ben\s+carril\s+din\b/gi, 'pe sina DIN'],
  [/\bmetal\s+case\b/gi, 'carcasa metalica'],
  [/\bbianco\s+caldo\b/gi, 'alb cald'],
  [/\bblanco\s+calido\b/gi, 'alb cald'],
  [/\bwarm\s+white\b/gi, 'alb cald'],
  [/\bbianco\s+freddo\b/gi, 'alb rece'],
  [/\bblanco\s+frio\b/gi, 'alb rece'],
  [/\bcool\s+white\b/gi, 'alb rece'],
  [/\bcold\s+white\b/gi, 'alb rece'],
  [/\bbianco\s+neutro\b/gi, 'alb neutru'],
  [/\bblanco\s+neutro\b/gi, 'alb neutru'],
  [/\bneutral\s+white\b/gi, 'alb neutru'],
  [/\bnot\s+dimmable\b/gi, 'fara dimare'],
  [/\bnon\s+dimmable\b/gi, 'fara dimare'],
  [/\bno\s+regulable\b/gi, 'fara dimare'],
  [/\bled\s+strip\b/gi, 'banda LED'],
  [/\bled\s+streifen\b/gi, 'banda LED'],
  [/\btira\s+led\b/gi, 'banda LED'],
  [/\bstriscia\s+led\b/gi, 'banda LED'],
  [/\bταινια\s+led\b/gi, 'banda LED'],
  [/\bлента\s+led\b/gi, 'banda LED'],
  [/\bmotion\s+sensor\b/gi, 'senzor de miscare'],
  [/\bsensore\s+di\s+movimento\b/gi, 'senzor de miscare'],
  [/\bsensor\s+de\s+movimiento\b/gi, 'senzor de miscare'],
  [/\bbewegungssensor\b/gi, 'senzor de miscare'],
];

const WORD_REPLACEMENTS: ReplacementRule[] = [
  // Polish
  [/\bzasilacz\b/gi, 'sursa de alimentare'],
  [/\btasma\b/gi, 'banda'],
  [/\bprzewod\b/gi, 'cablu'],
  [/\bkabel\b/gi, 'cablu'],
  [/\boprawa\b/gi, 'corp de iluminat'],
  [/\blampa\b/gi, 'lampa'],
  [/\bzarowka\b/gi, 'bec'],
  [/\bnaswietlacz\b/gi, 'proiector'],
  [/\bprofil\b/gi, 'profil'],
  [/\bczujnik\b/gi, 'senzor'],
  [/\bsciemniacz\b/gi, 'dimmer'],
  [/\bsterownik\b/gi, 'controller'],
  [/\bpilot\b/gi, 'telecomanda'],
  [/\bobudowa\b/gi, 'carcasa'],
  [/\bwodoodporn\w*\b/gi, 'rezistent la apa'],
  [/\bdimmable\b/gi, 'cu dimare'],
  [/\bcieply\b/gi, 'cald'],
  [/\bzimny\b/gi, 'rece'],
  [/\bneutralny\b/gi, 'neutru'],
  [/\bbial\w*\b/gi, 'alb'],
  [/\bczarn\w*\b/gi, 'negru'],
  [/\bczerw\w*\b/gi, 'rosu'],
  [/\bzielon\w*\b/gi, 'verde'],
  [/\bniebiesk\w*\b/gi, 'albastru'],
  [/\bzol\w*\b/gi, 'galben'],
  [/\bwewnetrzn\w*\b/gi, 'interior'],
  [/\bzewnetrzn\w*\b/gi, 'exterior'],
  [/\bnatynkow\w*\b/gi, 'aplicat'],
  [/\bpodtynkow\w*\b/gi, 'incastrat'],

  // Italian
  [/\balimentatore\b/gi, 'sursa de alimentare'],
  [/\bstriscia\b/gi, 'banda'],
  [/\bcavo\b/gi, 'cablu'],
  [/\bsensore\b/gi, 'senzor'],
  [/\bdimmerabile\b/gi, 'cu dimare'],
  [/\bcaldo\b/gi, 'cald'],
  [/\bfreddo\b/gi, 'rece'],
  [/\bneutro\b/gi, 'neutru'],
  [/\bbianco\b/gi, 'alb'],
  [/\bnero\b/gi, 'negru'],
  [/\brosso\b/gi, 'rosu'],
  [/\bverde\b/gi, 'verde'],
  [/\bblu\b/gi, 'albastru'],
  [/\bgiallo\b/gi, 'galben'],

  // German
  [/\bnetzteil\b/gi, 'sursa de alimentare'],
  [/\bstreifen\b/gi, 'banda'],
  [/\bkabel\b/gi, 'cablu'],
  [/\bsensor\b/gi, 'senzor'],
  [/\bdimmbar\b/gi, 'cu dimare'],
  [/\bwarmweiss\b/gi, 'alb cald'],
  [/\bkaltweiss\b/gi, 'alb rece'],
  [/\bneutralweiss\b/gi, 'alb neutru'],
  [/\bweiss\b/gi, 'alb'],
  [/\bschwarz\b/gi, 'negru'],
  [/\brot\b/gi, 'rosu'],
  [/\bgrun\b/gi, 'verde'],
  [/\bblau\b/gi, 'albastru'],
  [/\bgelb\b/gi, 'galben'],

  // Spanish
  [/\balimentacion\b/gi, 'alimentare'],
  [/\bfuente\b/gi, 'sursa'],
  [/\btira\b/gi, 'banda'],
  [/\bcable\b/gi, 'cablu'],
  [/\bsensor\b/gi, 'senzor'],
  [/\bregulable\b/gi, 'cu dimare'],
  [/\bcalido\b/gi, 'cald'],
  [/\bfrio\b/gi, 'rece'],
  [/\bblanco\b/gi, 'alb'],
  [/\bnegro\b/gi, 'negru'],
  [/\brojo\b/gi, 'rosu'],
  [/\bverde\b/gi, 'verde'],
  [/\bazul\b/gi, 'albastru'],
  [/\bamarillo\b/gi, 'galben'],

  // Greek
  [/τροφοδοτικο/gi, 'sursa de alimentare'],
  [/ταινια/gi, 'banda'],
  [/καλωδιο/gi, 'cablu'],
  [/προφιλ/gi, 'profil'],
  [/αισθητηρας/gi, 'senzor'],
  [/ρυθμιζομενο/gi, 'cu dimare'],
  [/θερμο/gi, 'cald'],
  [/ψυχρο/gi, 'rece'],
  [/ουδετερο/gi, 'neutru'],
  [/λευκο/gi, 'alb'],
  [/μαυρο/gi, 'negru'],
  [/κοκκινο/gi, 'rosu'],
  [/πρασινο/gi, 'verde'],
  [/μπλε/gi, 'albastru'],
  [/κιτρινο/gi, 'galben'],

  // Bulgarian
  [/захранване/gi, 'sursa de alimentare'],
  [/лента/gi, 'banda'],
  [/кабел/gi, 'cablu'],
  [/профил/gi, 'profil'],
  [/сензор/gi, 'senzor'],
  [/димер/gi, 'dimmer'],
  [/димируем/gi, 'cu dimare'],
  [/топло/gi, 'cald'],
  [/студено/gi, 'rece'],
  [/неутрално/gi, 'neutru'],
  [/бял/gi, 'alb'],
  [/черен/gi, 'negru'],
  [/червен/gi, 'rosu'],
  [/зелен/gi, 'verde'],
  [/син/gi, 'albastru'],
  [/жълт/gi, 'galben'],
];

function applyCaseStyle(match: string, replacement: string): string {
  if (match === match.toUpperCase()) {
    return replacement.toUpperCase();
  }

  if (match.length > 0 && match[0] === match[0].toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }

  return replacement;
}

function applyRules(value: string, rules: ReplacementRule[]): string {
  let result = value;

  for (const [pattern, replacement] of rules) {
    result = result.replace(pattern, (match) => applyCaseStyle(match, replacement));
  }

  return result;
}

function normalizeInput(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function translateSupplierProductName(name: string): string {
  const normalized = normalizeInput(name);
  if (!normalized) {
    return '';
  }

  const withTranslatedPhrases = applyRules(normalized, PHRASE_REPLACEMENTS);
  const withTranslatedWords = applyRules(withTranslatedPhrases, WORD_REPLACEMENTS);

  return withTranslatedWords
    .replace(/\s+,/g, ',')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
