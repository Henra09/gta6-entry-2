// The story missions of SOL DORADO: eight missions with giver markers, objectives,
// dialogue, and staged steps (drive to, steal car, survive shootout, chase, deliver).
// Mission types are driven by step machines defined in data terms.

export const MISSIONS = [
  {
    id: 'm0', giver: 'ROSARIO', title: 'LOW TIDE, HIGH HOPES',
    brief: 'Rosario runs the boardwalk. She wants a word about work — meet her at the Old Harbor.',
    steps: [
      { type: 'goto', marker: { x: 300, y: 300 }, radius: 40, text: 'Meet Rosario in Old Harbor' },
      { type: 'dialog', lines: [
        ['ROSARIO', 'You made it off the bus, kid. Sol Dorado eats people like you by sundown.'],
        ['ROSARIO', 'But you look useful. Drive this package to the Marina Royale drop before the tide turns.'],
        ['ME', 'A package? That all?'],
        ['ROSARIO', 'It is if nobody opens it. GO.'],
      ] },
      { type: 'goto-drive', marker: { x: 1680, y: 1840 }, radius: 60, text: 'Deliver the package to the marina drop', giveCar: { x: 420, y: 380 } },
      { type: 'reward', money: 400, text: 'Package delivered.' },
    ],
  },
  {
    id: 'm1', giver: 'EL CHINO', title: 'SMOKE OVER MIRADOR',
    brief: 'El Chino owns half the food carts on the Mirador Strip. The Cuervos burned one. Return the favor.',
    steps: [
      { type: 'dialog', lines: [
        ['EL CHINO', 'The Cuervos torched my best cart. Right on the Strip, in daylight.'],
        ['EL CHINO', 'Their lieutenant cruises Palm Heights in a red Compacta. Take it. Take him off the street.'],
        ['ME', 'And the cart?'],
        ['EL CHINO', 'Insurance pays for woks. Respect, I pay in cash.'],
      ] },
      { type: 'steal-target', text: 'Steal the red Compacta in Palm Heights', marker: { x: 1240, y: 1240 }, spawn: { kind: 'car', x: 1280, y: 1218, color: '#c83428', type: 0 } },
      { type: 'goto-drive', marker: { x: 620, y: 890 }, radius: 60, text: 'Bring the car to El Chino\'s garage' },
      { type: 'reward', money: 600, text: 'Debt paid in full.' },
    ],
  },
  {
    id: 'm2', giver: 'CAPITÁN VEGA', title: 'PIRATE TIDE',
    brief: 'Captain Vega of the harbor patrol is clean, which makes her rare. Smugglers are running guns off Costa Vista.',
    steps: [
      { type: 'dialog', lines: [
        ['CAPITÁN VEGA', 'Off the record: smugglers are unloading at the north beach every night.'],
        ['CAPITÁN VEGA', 'My hands are tied by paperwork. Yours are not. Stop the run.'],
        ['ME', 'You want a criminal to catch criminals.'],
        ['CAPITÁN VEGA', 'I want results. So does your wallet.'],
      ] },
      { type: 'goto', marker: { x: 3220, y: 480 }, radius: 70, text: 'Get to the north beach before the runners load' },
      { type: 'survive', seconds: 40, text: 'Hold the beach against the smugglers', wanted: 2 },
      { type: 'reward', money: 800, text: 'The run is dead. Vega nods, once.' },
    ],
  },
  {
    id: 'm3', giver: 'MARISOL', title: 'THE LONG SANDWICH RUN',
    brief: 'Marisol runs sandwiches, secrets and a courier ring. A rival crew is hitting her riders.',
    steps: [
      { type: 'dialog', lines: [
        ['MARISOL', 'Three riders went out. One came back, and he came back crying.'],
        ['MARISOL', 'Deliver my three bags across town before the Cuervos pick them off. Fast, clean, no drama.'],
        ['ME', 'No drama is my middle name.'],
        ['MARISOL', 'Your middle name is trouble. Go.'],
      ] },
      { type: 'delivery', drops: [ { x: 1680, y: 240 }, { x: 720, y: 2400 }, { x: 3080, y: 1960 } ], text: 'Deliver the bags (0/3)', giveCar: { x: 2380, y: 1740 } },
      { type: 'reward', money: 700, text: 'All bags hot and delivered.' },
    ],
  },
  {
    id: 'm4', giver: 'BRUNO', title: 'IRON IN THE FIRE',
    brief: 'Bruno lifts cars for a living and worships one: the Marina Sport prototype parked on El Corazón.',
    steps: [
      { type: 'dialog', lines: [
        ['BRUNO', 'There is a prototype on El Corazón. Marina Sport. One of one.'],
        ['BRUNO', 'Its owner guards it with two goons and a bad attitude. Bring it to my garage in one piece.'],
        ['ME', 'Define one piece.'],
        ['BRUNO', 'Mostly paint.'],
      ] },
      { type: 'steal-target', text: 'Take the Marina Sport from El Corazón', marker: { x: 620, y: 1840 }, spawn: { kind: 'car', x: 660, y: 1818, color: '#205a6e', type: 4 } },
      { type: 'goto-drive', marker: { x: 2240, y: 240 }, radius: 60, text: 'Drive it to Bruno\'s garage in Palm Heights' },
      { type: 'reward', money: 1100, text: 'She purrs like money.' },
    ],
  },
  {
    id: 'm5', giver: 'LA SOMBRA', title: 'NOBODY SEES NOTHING',
    brief: 'La Sombra pays for silence. The Cuervos\' boss meets his bookkeeper at the Palma FM tower tonight.',
    steps: [
      { type: 'dialog', lines: [
        ['LA SOMBRA', 'You do not know me. You never met me. Understand?'],
        ['LA SOMBRA', 'The Cuervo boss meets his bookkeeper tonight. Both of them talk too much.'],
        ['ME', 'Talk to who?'],
        ['LA SOMBRA', 'To anyone. That is the problem.'],
      ] },
      { type: 'goto', marker: { x: 2800, y: 1400 }, radius: 70, text: 'Get to the Palma FM tower in Costa Vista' },
      { type: 'survive', seconds: 45, text: 'Silence the meeting — survive the response', wanted: 3 },
      { type: 'reward', money: 1300, text: 'Nothing happened here tonight.' },
    ],
  },
  {
    id: 'm6', giver: 'ROSARIO', title: 'THE HEAT OF NOON',
    brief: 'Rosario has one last job: hit the Cuervos\' stash convoy as it crosses Mirador and drive it out of the city.',
    steps: [
      { type: 'dialog', lines: [
        ['ROSARIO', 'The Cuervos are moving their stash at noon. One truck, four guns, one chance.'],
        ['ROSARIO', 'Take the truck out, grab the stash, and get it to my dock before the city boils over.'],
        ['ME', 'And after this?'],
        ['ROSARIO', 'After this, kid... you stop being a kid.'],
      ] },
      { type: 'survive', seconds: 40, text: 'Take out the Cuervo escort on the Mirador Strip', wanted: 3, marker: { x: 1680, y: 960 } },
      { type: 'goto-drive', marker: { x: 3400, y: 2860 }, radius: 80, text: 'Run the stash to Rosario\'s dock in Costa Vista' },
      { type: 'reward', money: 2000, text: 'The Cuervos are done in Sol Dorado.' },
    ],
  },
  {
    id: 'm7', giver: 'ROSARIO', title: 'SUNSET OVER SOL DORADO',
    brief: 'The last piece: Rosario names the rat who sold everyone out, and the city gets a new boss. Maybe you.',
    steps: [
      { type: 'dialog', lines: [
        ['ROSARIO', 'The rat was close to both of us, kid. Closer than the tide.'],
        ['ROSARIO', 'He is holed up in El Corazón with every gun he ever bought. End it.'],
        ['ME', 'And then?'],
        ['ROSARIO', 'And then Sol Dorado belongs to whoever is still standing. See you at sunset.'],
      ] },
      { type: 'goto', marker: { x: 620, y: 2400 }, radius: 70, text: 'Hit the hideout in El Corazón' },
      { type: 'survive', seconds: 50, text: 'Finish the rat\'s whole crew', wanted: 4 },
      { type: 'reward', money: 3000, text: 'SOL DORADO HAS A NEW BOSS. THE END... OR THE BEGINNING.' },
    ],
  },
];
