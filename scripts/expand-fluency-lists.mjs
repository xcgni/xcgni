// Expand category-fluency accept-lists so valid common answers aren't falsely rejected.
// Merges large curated word sets into each challenge's acceptList (union with existing,
// deduped, lowercased). Run: node scripts/expand-fluency-lists.mjs
// Idempotent - re-running just re-merges the same sets.

import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'challenge-bank/retrieval-fluency/retrieval.levels.json';

// Comprehensive (not exhaustive - no list can be) sets of common answers. Aim: a typical
// player naming 10-20 items should essentially never hit a false rejection.
const SETS = {
  ANIMALS: `dog cat horse cow sheep goat pig lion tiger bear wolf fox deer rabbit mouse rat
    elephant giraffe zebra monkey gorilla kangaroo koala panda leopard cheetah hyena otter
    beaver squirrel hedgehog bat whale dolphin seal walrus camel donkey mule buffalo bison
    moose elk antelope rhino rhinoceros hippo hippopotamus crocodile alligator snake lizard
    frog toad turtle tortoise shark octopus lynx bobcat cougar puma jaguar panther badger
    weasel ferret mole raccoon skunk porcupine armadillo sloth llama alpaca hamster gerbil
    guinea mongoose meerkat chimpanzee chimp baboon orangutan lemur gibbon hare chipmunk
    boar warthog wildebeest gazelle impala oryx ibex hyrax aardvark anteater platypus wombat
    wallaby possum opossum tasmanian dingo coyote jackal hedgehog mink otter stoat marten
    wolverine seal sealion manatee dugong narwhal orca porpoise penguin seahorse jellyfish
    starfish crab lobster shrimp squid clam oyster snail slug worm spider scorpion ant bee
    wasp butterfly moth beetle ladybug dragonfly grasshopper cricket mantis cockroach fly
    mosquito flea tick centipede millipede eagle hawk falcon owl vulture crow raven sparrow
    robin finch pigeon dove swan goose duck chicken rooster hen turkey peacock ostrich emu
    flamingo pelican heron stork crane seagull parrot toucan woodpecker hummingbird
    salamander newt gecko iguana chameleon cobra python viper rattlesnake boa anaconda
    bull calf foal piglet lamb kitten puppy cub fawn`,

  FRUITS: `apple banana orange pear grape peach plum cherry strawberry blueberry raspberry
    blackberry mango pineapple watermelon melon cantaloupe honeydew kiwi lemon lime grapefruit
    apricot nectarine pomegranate fig date coconut papaya guava passionfruit lychee
    dragonfruit persimmon plantain tangerine clementine mandarin cranberry gooseberry
    blackcurrant redcurrant elderberry mulberry boysenberry tomato avocado olive quince
    starfruit jackfruit durian rambutan kumquat tamarind breadfruit prune raisin currant
    nectarine damson greengage`,

  COUNTRIES: `china india usa america france germany italy spain japan brazil canada mexico
    russia australia egypt nigeria kenya argentina chile peru colombia portugal greece turkey
    poland sweden norway denmark finland ireland scotland england wales netherlands belgium
    switzerland austria hungary romania bulgaria ukraine croatia serbia slovenia slovakia
    czechia czech morocco algeria tunisia libya ethiopia ghana tanzania uganda zimbabwe
    angola mozambique madagascar cuba jamaica haiti venezuela ecuador bolivia paraguay
    uruguay iran iraq israel jordan lebanon syria saudi yemen oman qatar kuwait bahrain
    pakistan bangladesh afghanistan nepal bhutan thailand vietnam cambodia laos myanmar
    malaysia indonesia philippines singapore korea taiwan mongolia kazakhstan uzbekistan
    iceland luxembourg malta cyprus estonia latvia lithuania belarus moldova georgia armenia
    azerbaijan newzealand fiji panama costa guatemala honduras nicaragua salvador`,

  COLORS: `red orange yellow green blue purple pink brown black white grey gray violet indigo
    cyan magenta turquoise teal maroon navy beige tan cream ivory gold silver bronze crimson
    scarlet amber lime olive emerald jade aqua azure cobalt lavender lilac mauve plum burgundy
    coral salmon peach apricot mustard ochre khaki charcoal slate ash rust copper bronze brass
    rose fuchsia magenta periwinkle chartreuse vermilion sepia tangerine`,

  'BODY PARTS': `head neck shoulder arm elbow wrist hand finger thumb chest back stomach belly
    hip leg knee ankle foot toe heel eye ear nose mouth lip tongue tooth teeth cheek chin
    forehead eyebrow eyelash jaw skull brain heart lung liver kidney stomach spine rib pelvis
    muscle bone skin hair nail palm knuckle thigh calf shin groin waist throat collarbone
    spleen bladder intestine artery vein nerve tendon ligament cartilage scalp temple nostril
    eyelid pupil iris gum heel sole`,

  BIRDS: `eagle hawk falcon owl vulture crow raven sparrow robin finch pigeon dove swan goose
    duck chicken rooster hen turkey peacock ostrich emu flamingo pelican heron stork crane
    seagull gull parrot parakeet toucan woodpecker hummingbird kingfisher magpie jay starling
    swallow swift wren blackbird thrush nightingale lark cardinal bluejay canary cockatoo
    macaw budgie pheasant quail partridge grouse puffin albatross cormorant kestrel buzzard
    osprey condor ibis egret cuckoo woodpigeon dunnock chaffinch goldfinch greenfinch tit
    nuthatch warbler`,

  VEGETABLES: `carrot potato onion tomato cucumber lettuce cabbage broccoli cauliflower spinach
    pea bean corn pepper celery garlic ginger pumpkin squash zucchini courgette eggplant
    aubergine radish beet beetroot turnip parsnip leek asparagus artichoke kale chard
    cabbage sprout mushroom okra yam sweetcorn shallot scallion fennel watercress rocket
    arugula endive chicory swede mangetout edamame`,

  TREES: `oak pine maple birch willow elm ash beech cedar spruce fir redwood sequoia palm
    cherry apple pear plum walnut chestnut hazel hawthorn rowan sycamore poplar aspen alder
    hornbeam yew juniper cypress magnolia eucalyptus baobab mahogany teak ebony bamboo olive
    fig date acacia jacaranda dogwood holly laurel linden lime horsechestnut larch`,

  FLOWERS: `rose tulip daisy lily sunflower daffodil orchid carnation iris violet poppy
    marigold petunia pansy lavender jasmine peony chrysanthemum dahlia hyacinth crocus
    snowdrop bluebell foxglove geranium begonia lotus magnolia camellia azalea rhododendron
    hydrangea lilac wisteria buttercup dandelion primrose tulip aster zinnia gladiolus
    freesia anemone clematis honeysuckle morningglory cornflower`,

  PROFESSIONS: `doctor nurse teacher lawyer engineer scientist farmer chef cook baker butcher
    plumber electrician carpenter mechanic pilot driver soldier police firefighter dentist
    accountant architect artist musician writer journalist photographer actor director
    waiter waitress cashier salesman manager secretary clerk programmer developer designer
    professor surgeon pharmacist veterinarian vet psychologist therapist optician barber
    hairdresser tailor jeweller mason painter welder builder miner fisherman sailor captain
    judge politician banker economist librarian translator interpreter consultant`,

  SPORTS: `football soccer basketball baseball tennis golf cricket rugby hockey volleyball
    badminton swimming running cycling boxing wrestling judo karate taekwondo fencing
    archery rowing sailing surfing skiing snowboarding skating gymnastics athletics
    marathon sprinting hurdles javelin discus shotput highjump longjump polevault diving
    handball squash racquetball bowling darts billiards snooker pool curling lacrosse
    polo equestrian climbing hiking weightlifting triathlon biathlon`,

  DRINKS: `water tea coffee juice milk soda cola lemonade beer wine whiskey vodka rum gin
    brandy champagne cider cocktail smoothie milkshake hotchocolate cocoa espresso latte
    cappuccino mocha americano squash punch cordial tonic soda sprite fanta orangeade
    gingerale kombucha cider mead sake tequila martini margarita mojito sangria`,

  'KITCHEN ITEMS': `knife fork spoon plate bowl cup mug glass pot pan kettle toaster oven
    stove fridge microwave blender mixer whisk spatula ladle grater peeler colander sieve
    chopping board cutlingboard rollingpin tongs scissors corkscrew opener tray dish jug
    teapot saucepan frypan wok cleaver masher strainer funnel timer scale thermometer
    skewer apron oven gloves`,

  'MUSICAL INSTRUMENTS': `piano guitar violin drums flute trumpet saxophone clarinet cello
    harp trombone tuba oboe bassoon accordion harmonica banjo mandolin ukulele bass keyboard
    organ xylophone tambourine triangle cymbals bongos maracas recorder bagpipes sitar
    didgeridoo synthesizer viola doublebass frenchhorn piccolo glockenspiel marimba
    vibraphone castanets gong harpsichord lute`,

  SHAPES: `circle square triangle rectangle oval pentagon hexagon octagon heptagon nonagon
    decagon rhombus diamond trapezoid parallelogram cube sphere cylinder cone pyramid prism
    star crescent heart ellipse semicircle quadrilateral polygon cuboid tetrahedron
    octahedron dodecahedron arc ring`,

  METALS: `iron gold silver copper aluminium aluminum lead tin zinc nickel platinum titanium
    steel bronze brass mercury chromium cobalt magnesium tungsten uranium plutonium sodium
    potassium calcium lithium manganese cadmium palladium rhodium iridium osmium gallium
    indium antimony bismuth beryllium vanadium`,

  'CHEMICAL ELEMENTS': `hydrogen helium lithium beryllium boron carbon nitrogen oxygen fluorine
    neon sodium magnesium aluminium silicon phosphorus sulfur sulphur chlorine argon potassium
    calcium iron copper zinc silver gold mercury lead tin nickel cobalt titanium chromium
    manganese uranium plutonium platinum helium krypton xenon radon iodine bromine barium
    cesium caesium tungsten arsenic selenium`,

  GEMSTONES: `diamond ruby emerald sapphire pearl opal amethyst topaz garnet jade turquoise
    aquamarine citrine peridot onyx agate quartz amber jasper malachite lapis moonstone
    tanzanite tourmaline zircon spinel beryl coral jet obsidian bloodstone carnelian`,

  'PLANETS OR MOONS': `mercury venus earth mars jupiter saturn uranus neptune pluto moon
    luna phobos deimos io europa ganymede callisto titan enceladus mimas triton charon
    rhea iapetus dione tethys ceres eris haumea makemake`,

  LANGUAGES: `english spanish french german italian portuguese chinese mandarin cantonese
    japanese korean russian arabic hindi bengali urdu turkish dutch swedish norwegian danish
    finnish polish czech greek hebrew thai vietnamese indonesian malay swahili zulu
    afrikaans croatian serbian ukrainian romanian hungarian bulgarian slovak slovenian
    catalan basque welsh irish gaelic latin persian farsi tamil telugu punjabi`,

  'ITEMS OF CLOTHING': `shirt trousers pants jeans dress skirt blouse sweater jumper jacket
    coat hat cap scarf gloves socks shoes boots sandals sneakers trainers belt tie suit
    shorts vest underwear bra hoodie cardigan blazer raincoat anorak pyjamas pajamas robe
    swimsuit bikini leggings tights stockings overalls dungarees waistcoat poncho cape
    mittens beanie`,

  'FARM ANIMALS': `cow bull calf horse pony donkey mule pig piglet sheep lamb ram goat kid
    chicken hen rooster chick duck goose turkey rabbit dog cat ox buffalo llama alpaca
    geese duckling gosling foal sow boar ewe billy nanny`
};

const data = JSON.parse(readFileSync(FILE, 'utf8'));
const items = Array.isArray(data) ? data : (data.challenges ?? data.items ?? []);

function keyFor(instruction) {
  const up = instruction.toUpperCase();
  // check multi-word / more-specific keys first so "FARM ANIMALS" doesn't match "ANIMALS"
  const ordered = Object.keys(SETS).sort((a, b) => b.length - a.length);
  for (const k of ordered) {
    if (up.includes(k)) return k;
  }
  return null;
}

let expanded = 0;
for (const it of items) {
  const ad = it.answerData;
  if (!ad || !Array.isArray(ad.acceptList)) continue;
  if (ad.constraint && String(ad.constraint).length === 1) continue; // letter fluency: rule-based
  const k = keyFor(it.promptData?.instruction ?? '');
  if (!k) continue;
  const before = ad.acceptList.length;
  const merged = new Set(ad.acceptList.map((w) => String(w).trim().toLowerCase()));
  for (const w of SETS[k].split(/\s+/).map((x) => x.trim().toLowerCase()).filter(Boolean)) merged.add(w);
  ad.acceptList = [...merged].sort();
  if (ad.acceptList.length !== before) {
    expanded++;
    console.log(`  ${it.bankKey} (${k}): ${before} -> ${ad.acceptList.length}`);
  }
}

writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
console.log(`\nExpanded ${expanded} category accept-lists.`);
