// docs/categorisation.md, "Seed categories and keywords". The array order is the priority order:
// when a reference names things from two categories, the earlier one wins. A word appears once, in
// the first category that lists it (`market` is Food, `printing` is Education).

export interface SeedKeywordSet {
  systemKey: string;
  words: readonly string[];
  /** Misspellings fuzzy matching would miss or get wrong. Exact-only. */
  aliases?: readonly string[];
}

const split = (csv: string): string[] => csv.split(',').map((w) => w.trim());

export const SEED_KEYWORDS: readonly SeedKeywordSet[] = [
  { systemKey: 'airtime', words: split('airtime, bundle, data, recharge, credit, top up, topup') },
  {
    systemKey: 'food',
    words: split(
      `rice, jollof, fried rice, waakye, banku, kenkey, fufu, omotuo, rice balls, gari,
       gari and beans, red red, yam, kontomire, palava sauce, light soup, groundnut soup,
       palm nut soup, soup, stew, fish, tilapia, chicken, meat, kebab, khebab, shawarma, pizza,
       burger, sausage, egg, eggs, bread, tea bread, sugar bread, butter bread, beans, koko,
       hausa koko, porridge, oats, indomie, noodles, spaghetti, macaroni, plantain, kelewele,
       kokonte, tuo zaafi, tz, ampesi, boflot, bofrot, togbei, doughnut, pie, meat pie, cake,
       biscuit, snack, snacks, groundnut, ground nut, nkate, tomatoes, onion, pepper, salt, oil,
       sugar, milk, nido, yoghurt, yogurt, drink, juice, water, sobolo, bissap, lamugin, coke,
       fanta, malt, lunch, dinner, breakfast, food, chop, groceries, provisions, market,
       provision, kiosk, restaurant, joint, snack bar`,
    ),
    aliases: ['kenky', 'waskye', 'wayer', 'shitor'],
  },
  {
    systemKey: 'transport',
    words: split(
      `trotro, tro tro, taxi, uber, bolt, yango, fuel, petrol, diesel, bus, fare, transport,
       okada, aboboyaa, ticket, stc, vip, toll, parking`,
    ),
  },
  {
    systemKey: 'rent',
    words: split(
      `rent, ecg, electricity, light bill, water bill, gwcl, bill, bills, wifi, internet, dstv,
       gotv, startimes, tv, waste, maintenance, hostel, motel, accommodation, lodging, loan,
       instalment, installment`,
    ),
  },
  {
    systemKey: 'shopping',
    words: split(
      `clothes, cloth, shoes, slippers, bag, shirt, shirts, dress, trousers, jeans, jumia,
       melcom, mall, shop, shopping, perfume, watch, comb, sponge, tape, stationery, pen, paper,
       stickers`,
    ),
  },
  {
    systemKey: 'electronics',
    words: split(
      `charger, battery, earpiece, earbuds, ear buds, headphone, keyboard, mouse, hard disk,
       cable, usb, adapter, phone, laptop, screen, speaker, powerbank, power bank, controller`,
    ),
  },
  {
    systemKey: 'health',
    words: split(
      `pharmacy, chemist, drugs, drug, medicine, hospital, clinic, doctor, lab, scan, test,
       malaria, paracetamol, vitamins, inhaler, nhis, dentist, eye, glasses, checkup`,
    ),
  },
  {
    systemKey: 'education',
    words: split(
      `school, fees, tuition, books, book, exam, course, class, lecture, printing, photocopy,
       forms, form, registration, project, assignment, udemy`,
    ),
  },
  {
    systemKey: 'entertainment',
    words: split(
      `spotify, netflix, youtube, showmax, movie, cinema, game, games, esports, betting, bet,
       sportybet, subscription, music, party, club, outing, trip`,
    ),
  },
  {
    systemKey: 'personalcare',
    words: split(
      `haircut, hair cut, barber, salon, braids, hair, makeup, nails, soap, toiletries, lotion,
       deodorant, toothpaste, shaving, laundry`,
    ),
  },
  {
    systemKey: 'giving',
    words: split(
      `offering, tithe, church, mosque, donation, gift, funeral, wedding, contribution, welfare,
       dues`,
    ),
  },
  {
    systemKey: 'savings',
    words: split(`susu, savings, save, invest, investment, mutual fund, treasury, piggy`),
  },
  {
    systemKey: 'services',
    words: split(
      `tailoring, tailor, repair, fix, delivery, courier, rider, plumber, electrician, mechanic,
       design, printing service, photographer`,
    ),
  },
];

/** Priority order of the keyword categories, earliest wins. */
export const KEYWORD_CATEGORY_ORDER: readonly string[] = SEED_KEYWORDS.map((s) => s.systemKey);

export interface BuiltInCounterpartyRule {
  /** Case-insensitive substrings of the counterparty name. */
  contains: readonly string[];
  systemKey: string;
}

// Order matters: the first rule with a hit wins, and paystack-style names stay in Misc.
export const COUNTERPARTY_RULES: readonly BuiltInCounterpartyRule[] = [
  { contains: ['paystack', 'mojopay', 'cellulant'], systemKey: 'misc' },
  {
    contains: [
      'mtn airtime',
      'mtn bundle',
      'mtnbundle',
      'just4u',
      'other networks',
      'telecel push',
      'mtn',
    ],
    systemKey: 'airtime',
  },
  { contains: ['bills'], systemKey: 'rent' },
];

export interface CounterpartyHint {
  /** Whole words (or a phrase) of the counterparty name. */
  words: readonly string[];
  systemKey: string;
}

export const COUNTERPARTY_HINTS: readonly CounterpartyHint[] = [
  { words: ['food', 'joint', 'chop bar', 'kitchen'], systemKey: 'food' },
  { words: ['pharmacy', 'chemist', 'clinic'], systemKey: 'health' },
  { words: ['fuel', 'filling'], systemKey: 'transport' },
];
