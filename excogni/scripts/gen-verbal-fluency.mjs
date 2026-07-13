// Generates the verbal_fluency bank: "produce words matching a constraint" (starts-with / ends-with).
// fluency_count scoring - the acceptList is the recognised set; it need not be exhaustive, but should
// be generous so real answers count. 20 prompts per level, L1-8, difficulty rising by constraint
// rarity (common single letters -> rarer clusters -> suffixes).

import { writeFileSync, mkdirSync } from 'node:fs';

// A compact lexicon grouped so we can assemble accept-lists per constraint. Lowercase, deduped.
const WORDS = `able about above across act add afraid after again age ago agree air all allow almost alone along already also always among angry animal answer any apple area arm army around arrive art ask asleep
baby back bad bag ball band bank bar base basket bath be beach bean bear beat beautiful because become bed bee before begin behind believe bell belong below belt bend best better between big bird birth bit bite black blame blank blanket blind block blood blow blue board boat body boil bone book boot border born borrow both bottle bottom bowl box boy brain branch brave bread break breakfast breath bridge bright bring broad broken brother brown brush build burn bus bush business busy but butter button buy
cake call calm camera camp can candle cap car card care careful carry case cat catch cause cell center century certain chain chair chance change chapter charge cheap check cheese chest chicken chief child choice choose church circle city class clean clear clever climb clock close cloth cloud club coast coat coffee coin cold collect college color come comfort common company compare complete computer condition control cook cool copy corn corner correct cost cotton cough count country course court cover cow crowd cry cup cut
dance danger dark date day dead deal dear death decide deep deer degree delay deliver depend desk deep desert design desk detail develop die diet differ difficult dig dinner direct dirt dirty distance divide doctor dog dollar door double doubt down draw dream dress drink drive drop dry duck during dust duty
each ear early earn earth east easy eat edge effect egg eight either elbow else empty end enemy energy engine enjoy enough enter equal escape even evening event ever every example except exchange excite exercise expect expert explain eye
face fact fail fair fall false family famous fan far farm fast fat father fault favor fear feed feel fellow female fence few field fight fill film final find fine finger finish fire first fish fit fix flag flat float floor flow flower fly fold follow food fool foot for force forest forget fork form free fresh friend frog from front fruit full fun funny fur
game garden gas gate gather general gentle get gift girl give glad glass go goal goat gold good govern grass gray great green ground group grow guard guess guest guide gun
hair half hall hand hang happen happy hard hat hate have head health hear heart heat heavy help here hide high hill hit hold hole holiday home honest hope horse hospital hot hotel hour house how huge human hundred hungry hunt hurry hurt
ice idea if ill important in inch include increase indeed inside into iron island
job join joke joy judge juice jump just
keep key kick kill kind king kiss kitchen knee knife knock know
lady lake lamp land large last late laugh law lay lazy lead leaf learn least leather leave left leg lemon lend length less let letter level library lie life lift light like line lion lip list listen little live load local lock lonely long look lose loss lot loud love low luck lunch
machine mad mail main make male man many map mark market marry master match matter may meal mean meat meet melon member memory mention metal middle might mile milk mind mine minute mirror miss mistake mix model modern moment money monkey month moon more morning most mother mountain mouse mouth move much music must
nail name narrow nation nature near neck need needle neighbor net never new news next nice night nine no noise none noon north nose not note nothing notice now number nurse nut
ocean of off offer office often oil old on once one onion only open or orange order other out over own
page pain paint pair paper park part party pass past path pay peace pen pencil people pepper perfect perhaps person phone pick picture piece pig pin pink pipe place plan plant plate play please pleasant pocket point poison police polite pool poor potato pour power practice praise pray prepare present press pretty price print prize problem promise proud public pull punish pure purple push put
queen question quick quiet quite
race radio rail rain raise reach read ready real reason receive record red remember repeat reply report rest return rice rich ride right ring rise river road rock roof room root rope rose round row rub rule run
sad safe sail salt same sand save say school science sea seat second secret see seed seem sell send sense separate serve set seven several sex shake shape share sharp she sheep shelf shine ship shirt shoe shoot shop short should shoulder shout show shut sick side sign silent silk silver simple sing single sister sit six size skin sky sleep slow small smell smile smoke snake snow so soap social soft soil soldier some son song soon sorry sound soup south space speak special speed spell spend spider spoon spread spring square stamp stand star start station stay steal steam step stick still stomach stone stop store storm story straight strange street strong study sugar suit summer sun sweet swim
table tail take talk tall taste tea teach team tear tell ten test than thank that the then there thick thin thing think third thirsty this though thought thread throat through throw thumb thunder ticket tie tiger time tiny tired title to today toe together tomorrow tongue tonight too tool tooth top touch toward tower town toy trade train travel tree trip trouble true trust try tube turn twelve twenty twice type
ugly umbrella uncle under understand until up upon use usual
valley value vegetable very village visit voice
wait wake walk wall want war warm wash waste watch water wave way weak wear weather week weight welcome well west wet what wheel when where which while white who whole why wide wife wild win wind window wine wing winter wire wise wish with woman wonder wood wool word work world worry worth wound write wrong
year yellow yes yesterday yet you young`.toLowerCase().split(/\s+/).filter(Boolean);

const uniq = [...new Set(WORDS)];

function startsWith(p) { return uniq.filter(w => w.startsWith(p)); }
function endsWith(s) { return uniq.filter(w => w.length > s.length && w.endsWith(s)); }

// per-level constraint pools - generous so 20 with usable accept-lists are always findable. The
// generator filters to constraints that actually have >=4 words in the lexicon, so extra candidates
// are harmless. Difficulty rises: common single letters -> clusters -> suffixes/prefixes.
const ALL_SINGLE = 'abcdefghilmnoprstuwy'.split('');
const COMMON_CLUSTERS = ['st','tr','bl','ch','gr','cl','fr','sp','dr','br','pl','cr','sl','sw','sn','sh','th','wh','fl','sc','pr','gl','tw','sk','sm'];
const SUFFIXES = ['ing','ed','er','ly','en','le','ow','ar','or','an','at','et','it','ot','ay','on','un','am','ay','ce','ng','nt','st','st','ess','ear','ide','ake','ight','ound'];
const PREFIXES = ['un','re','de','dis','pre','sub','in','con','com','ex','pro','per','over','under','out','up','for','be','en','mis','a','s','c','b','t','p','f','g','h','m'];
const ENDINGS2 = ['ness','tion','ment','able','less','ful','ous','ive','ity','ed','er','ly','en','ant','ent','ar','or','al','ic','age','y','e','t','d','n','s','l','k','p','m'];

const LEVELS = {
  1: ALL_SINGLE.map(c => ['start', c]),
  2: COMMON_CLUSTERS.map(c => ['start', c]).concat(['ba','be','bo','ca','co','de','di','fa','fi','ha','he','ho','la','li','lo','ma','me','mo','pa','po','re','sa','se','so','ta','te','to','wa','we','wi'].map(c => ['start', c])),
  3: ['str','spr','thr','sch','spl','scr'].map(c => ['start', c]).concat(COMMON_CLUSTERS.map(c => ['start', c])).concat(['ba','co','de','ma','pa','re','sa','se','sta','sto','tea','tra'].map(c => ['start', c])),
  4: SUFFIXES.map(c => ['end', c]),
  5: COMMON_CLUSTERS.map(c => ['start', c]).concat(ALL_SINGLE.map(c => ['start', c])),
  6: PREFIXES.map(c => ['start', c]),
  7: ENDINGS2.map(c => ['end', c]),
  8: ['ph','kn','wr','wh','qu','sc','ch','sh','th','tr','st','sp','sw','sn','sl','sm','pl','pr','gr','gl','cr','cl','bl','br','fr','fl'].map(c => ['start', c]).concat(['sk','tw','dr','spr','str','squ','spl','scr','thr'].map(c => ['start', c]))
};

const out = [];
for (let level = 1; level <= 8; level++) {
  const pool = LEVELS[level];
  const used = new Set();
  let made = 0;
  for (const [type, pat] of pool) {
    if (made >= 20) break;
    if (used.has(type + pat)) continue;
    const list = type === 'start' ? startsWith(pat) : endsWith(pat);
    if (list.length < 4) continue; // need a usable accept-list
    used.add(type + pat);
    made++;
    const label = type === 'start'
      ? `Words starting with '${pat.toUpperCase()}'`
      : `Words ending in '${pat.toUpperCase()}'`;
    out.push({
      bankKey: `vf-L${level}-${made}`,
      category: 'verbal_fluency',
      challengeType: 'word_fluency',
      level,
      rendererType: 'fluency_list',
      promptData: { instruction: label, timeMs: 30000, constraint: pat },
      answerData: { acceptList: list, constraint: pat, constraintType: type, scoringMode: 'fluency_count' },
      scoringConfig: { expectedMedianMs: 30000, fluency: true },
      version: 1, active: true
    });
  }
  if (made < 20) console.error(`L${level}: only ${made}/20 (some constraints too sparse in lexicon)`);
}

mkdirSync('challenge-bank/verbal-fluency', { recursive: true });
writeFileSync('challenge-bank/verbal-fluency/verbal-fluency.levels.json', JSON.stringify(out, null, 2) + '\n');
const byLevel = {};
out.forEach(o => byLevel[o.level] = (byLevel[o.level] || 0) + 1);
console.log(`wrote ${out.length} verbal_fluency:`, Object.entries(byLevel).map(([l,n]) => `L${l}:${n}`).join(' '));
