// Add a short, accurate factoid to every retention card. Factoids are keyed by prompt so this is
// idempotent and maintainable: re-running re-applies the same set. Writes the 4th tuple element
// (note) into challenge-bank/retention/decks.json. Run: node scripts/populate-retention-notes.mjs

import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'challenge-bank/retention/decks.json';

// prompt -> factoid. Kept to one or two crisp sentences: the point is a moment of learning on a
// miss, not a lecture.
const NOTES = {
  // SI units & constants
  'The SI unit of force': 'Named after Isaac Newton. One newton accelerates 1 kg by 1 m/s2 - about the weight of a small apple.',
  'The SI unit of energy': 'Named after James Joule. One joule is roughly the energy to lift an apple one metre.',
  'The SI unit of power': 'Named after James Watt. One watt is one joule per second; a typical LED bulb draws around 8-10 W.',
  'The SI unit of electric current': 'Named after Andre-Marie Ampere. It measures the rate of flow of electric charge.',
  'The SI unit of pressure': 'Named after Blaise Pascal. One pascal is one newton per square metre - atmospheric pressure is about 101,325 Pa.',
  'The SI unit of frequency': 'Named after Heinrich Hertz. One hertz is one cycle per second.',
  'The SI unit of electric charge': 'Named after Charles-Augustin de Coulomb. One coulomb is the charge moved by one ampere in one second.',
  'The SI unit of resistance': 'Named after Georg Ohm. Ohm\'s law links voltage, current, and resistance: V = IR.',
  'The SI unit of magnetic flux density': 'Named after Nikola Tesla. An MRI machine\'s field is typically 1.5 to 3 tesla.',
  'The SI unit of temperature': 'Named after Lord Kelvin. It starts at absolute zero (-273.15 C), the coldest possible temperature.',
  'The SI unit of luminous intensity': 'The candela roughly equals the light of a single candle, as the name suggests.',
  'The SI unit of amount of substance': 'One mole contains Avogadro\'s number of particles - about 6.022 x 10^23.',
  'Approx speed of light (km/s)': 'Light travels about 299,792 km/s - fast enough to circle the Earth roughly 7.5 times in one second.',
  'Number of base SI units': 'The seven base units: metre, kilogram, second, ampere, kelvin, mole, and candela.',

  // World capitals
  'Capital of Japan': 'Tokyo became the capital in 1868, replacing Kyoto. Its greater metropolitan area is the most populous on Earth.',
  'Capital of Australia': 'Canberra was purpose-built as a compromise between rival cities Sydney and Melbourne.',
  'Capital of Canada': 'Ottawa was chosen by Queen Victoria in 1857, partly for being defensible and bilingual.',
  'Capital of Brazil': 'Brasilia was built from scratch in the late 1950s and inaugurated in 1960, inland from the coast.',
  'Capital of Egypt': 'Cairo sits on the Nile and is one of the oldest and largest cities in Africa and the Arab world.',
  'Capital of Croatia': 'Zagreb grew from two medieval settlements, Gradec and Kaptol, on facing hills.',
  'Capital of Kazakhstan': 'Renamed several times (Astana to Nur-Sultan and back to Astana), it became capital in 1997.',
  'Capital of Turkey': 'Ankara replaced Istanbul as capital in 1923 under Ataturk, in the country\'s interior.',
  'Capital of South Africa (administrative)': 'South Africa has three capitals; Pretoria is the administrative one, with Cape Town and Bloemfontein the others.',
  'Capital of New Zealand': 'Wellington is the southernmost national capital in the world and famously windy.',
  'Capital of Switzerland': 'Bern is the de facto capital ("federal city"); Switzerland has no single official capital by law.',
  'Capital of Morocco': 'Rabat has been the capital since 1912; Casablanca is larger but is the economic hub, not the capital.',
  'Capital of Argentina': 'Buenos Aires means "fair winds"; its residents are called portenos, "people of the port".',
  'Capital of Norway': 'Oslo was once called Christiania (after King Christian IV) until the name reverted in 1925.',

  // Scientific facts
  'Chemical symbol for gold': 'Au comes from the Latin aurum, "shining dawn". Gold is so unreactive it\'s found as a pure metal in nature.',
  'Chemical symbol for iron': 'Fe comes from the Latin ferrum. Iron is the most common element on Earth by mass.',
  'Chemical symbol for potassium': 'K comes from kalium, from the Arabic al-qaliy, "plant ashes".',
  'Chemical symbol for sodium': 'Na comes from the Latin natrium. Sodium is so reactive it\'s never found pure in nature.',
  'Chemical symbol for tungsten': 'W comes from wolfram. Tungsten has the highest melting point of any metal, 3,422 C.',
  'Atomic number of carbon': 'Carbon\'s six protons let it form four bonds, the basis of all known life\'s chemistry.',
  'Atomic number of oxygen': 'Oxygen\'s eight protons; it makes up about 21% of the air and 65% of the human body by mass.',
  'Number of chambers in the human heart': 'Two atria receive blood, two ventricles pump it out - a double pump in one organ.',
  'Powerhouse of the cell': 'Mitochondria make ATP and carry their own DNA, hinting they were once free-living bacteria.',
  'Gas plants absorb for photosynthesis': 'Plants take in CO2 and release oxygen, effectively running respiration in reverse using sunlight.',
  'Planet known as the red planet': 'Mars looks red because its surface is rich in iron oxide - literally rust.',
  'Largest planet in the solar system': 'Jupiter is so massive it could contain all the other planets combined, twice over.',
  'pH of pure water': 'A pH of 7 is neutral; lower is acidic, higher is alkaline, on a logarithmic scale.',
  'Hardest natural material': 'Diamond is pure carbon arranged in a rigid lattice - same element as soft graphite, different structure.',

  // Word roots
  'Greek root "bio" means': 'It gives us biology, biography, and antibiotic - all concerned with life.',
  'Greek root "geo" means': 'It gives us geography, geology, and geometry (originally "earth-measuring").',
  'Latin root "aqua" means': 'It gives us aquarium, aquatic, and aqueduct.',
  'Greek root "photo" means': 'It gives us photograph ("light-writing"), photosynthesis, and photon.',
  'Latin root "terra" means': 'It gives us terrain, territory, and extraterrestrial ("beyond Earth").',
  'Greek root "chronos" means': 'It gives us chronology, chronic, and synchronize ("same time").',
  'Latin root "manus" means': 'It gives us manual, manufacture ("made by hand"), and manuscript.',
  'Greek root "pathos" means': 'It gives us sympathy, empathy, and pathology - all about feeling or suffering.',
  'Latin root "vita" means': 'It gives us vital, vitamin, and revive.',
  'Greek root "psyche" means': 'It gives us psychology, psychiatry, and psyche itself - originally also "soul".',
  'Latin root "lumen" means': 'It gives us illuminate, luminous, and luminary.',
  'Greek root "demos" means': 'It gives us democracy ("rule by the people"), demographic, and epidemic.',

  // Film & cinema
  "The director of '2001: A Space Odyssey'": 'Stanley Kubrick was famous for obsessive perfectionism, sometimes demanding dozens of takes per shot.',
  "The director of 'Spirited Away'": 'Hayao Miyazaki co-founded Studio Ghibli; Spirited Away won the 2003 Best Animated Feature Oscar.',
  'The first film to win the Best Picture Oscar (1929)': 'Wings, a silent WWI aviation film, remains the only fully silent film to win Best Picture.',
  'The highest-grossing film franchise by character (a boy wizard)': 'The Harry Potter series spans eight films from 2001 to 2011, plus the Fantastic Beasts spin-offs.',
  "The director known for 'Pulp Fiction' and 'Kill Bill'": 'Quentin Tarantino is known for nonlinear storytelling and has said he plans to retire after ten films.',
  "The actor who played the Joker in 'The Dark Knight'": 'Heath Ledger won a posthumous Oscar for the role; he died before the film\'s release in 2008.',
  "The studio behind 'Toy Story'": 'Pixar\'s Toy Story (1995) was the first entirely computer-animated feature film.',
  "The film featuring the line 'Here's looking at you, kid'": 'Casablanca (1942) was shot during WWII; much of its emotional power was improvised under deadline.',
  "The director of 'Parasite', the first non-English Best Picture winner": 'Bong Joon-ho\'s Parasite (2019) was the first non-English-language film to win Best Picture.',
  "The composer of the 'Star Wars' score": 'John Williams has received over 50 Oscar nominations, more than any living person.',
  'The 1975 Spielberg film about a shark': 'Jaws is often credited as the first true summer blockbuster; the malfunctioning mechanical shark forced Spielberg to suggest the threat instead.',
  "The actress who played Ellen Ripley in 'Alien'": 'Sigourney Weaver\'s Ripley became a landmark for female action leads in science fiction.',
  "The Italian term for a film director's distinctive personal style": 'Auteur theory holds that the director is the true "author" of a film, stamping it with a personal vision.',
  'The first feature-length animated film by Disney (1937)': 'Snow White and the Seven Dwarfs was dubbed "Disney\'s Folly" before becoming a huge success.',

  // Literature
  "The author of 'Pride and Prejudice'": 'Jane Austen published anonymously in her lifetime, credited only as "By a Lady".',
  "The author of 'Crime and Punishment'": 'Fyodor Dostoevsky drew on his own years in a Siberian prison camp for his psychological depth.',
  "The author of 'One Hundred Years of Solitude'": 'Gabriel Garcia Marquez\'s novel is the landmark work of magical realism; he won the 1982 Nobel Prize.',
  "The Danish prince in Shakespeare's longest play": 'Hamlet is Shakespeare\'s longest play at about 4,000 lines; the title role is among the most demanding in theatre.',
  "The author of '1984' and 'Animal Farm'": 'George Orwell was a pen name; his real name was Eric Arthur Blair.',
  "The epic poem by Homer about Odysseus's journey home": 'The Odyssey recounts a ten-year voyage home from the Trojan War, full of monsters and gods.',
  "The author of 'In Search of Lost Time'": 'Marcel Proust\'s novel runs to roughly 1.2 million words, among the longest ever published.',
  'The whale hunted by Captain Ahab': 'Moby-Dick (1851) sold poorly in Melville\'s lifetime and was only hailed as a masterpiece decades later.',
  "The author of 'The Brothers Karamazov'": 'Dostoevsky\'s final novel; he died just months after completing it in 1880.',
  "The Italian poet who wrote 'The Divine Comedy'": 'Dante helped establish the Tuscan dialect as the basis of modern standard Italian.',
  "The author of 'Beloved' and 'Song of Solomon'": 'Toni Morrison won both the Pulitzer Prize and, in 1993, the Nobel Prize in Literature.',
  "The literary movement of Woolf and Joyce's stream-of-consciousness": 'Modernism broke with traditional narrative to capture the flow of inner experience.',
  "The author of 'The Trial' and 'The Metamorphosis'": 'Franz Kafka asked his friend to burn his manuscripts; thankfully, the friend refused.',
  'The three witches appear in this Shakespeare tragedy': 'Macbeth is so feared as unlucky in theatre that actors call it "the Scottish play".',

  // Philosophy
  "The philosopher who wrote 'I think, therefore I am'": 'Descartes\' "cogito" was his one certainty after doubting everything else - the foundation of modern philosophy.',
  'The Greek philosopher who taught Alexander the Great': 'Aristotle studied under Plato, then tutored Alexander, linking three giants of the ancient world.',
  "The philosopher of the 'categorical imperative'": 'Kant argued you should act only on principles you could will to become universal law.',
  "The philosopher who declared 'God is dead'": 'Nietzsche meant that belief had lost its cultural force, posing a crisis of meaning, not a literal claim.',
  "Socrates' most famous student": 'Plato recorded Socrates\' ideas in dialogues, since Socrates himself wrote nothing down.',
  'The school of philosophy founded by Zeno emphasizing virtue and acceptance': 'Stoicism teaches focusing only on what you control - a core idea behind modern cognitive therapy.',
  'The thought experiment of a cat both alive and dead': "Schrodinger devised the cat to show how strange quantum superposition becomes at everyday scale.",
  'The branch of philosophy concerned with knowledge': 'Epistemology asks what knowledge is, how we acquire it, and what justifies belief.',
  "The philosopher who wrote 'The Republic'": 'Plato\'s Republic explores justice through the famous allegory of the cave.',
  'The branch of philosophy concerned with being and existence': 'Metaphysics asks what fundamentally exists and what reality is made of.',
  'The principle that the simplest explanation is usually best': "Occam's razor: don't multiply entities beyond necessity. A guide, not a law.",
  "The philosopher of 'Leviathan' who described life as 'nasty, brutish, and short'": 'Hobbes argued people surrender some freedom to a strong state to escape a violent "state of nature".',
  'The ethical theory judging actions by their consequences': 'Consequentialism - including utilitarianism - judges acts by outcomes, not intentions or rules.',
  "The Roman emperor and Stoic who wrote 'Meditations'": 'Marcus Aurelius wrote Meditations privately as notes to himself, never meaning to publish them.',

  // General knowledge
  'The largest planet in the solar system': 'Jupiter is so massive it could swallow all the other planets twice over.',
  'The chemical symbol for gold': 'Au is from the Latin aurum. Gold is rare partly because it forms in neutron-star collisions.',
  'The number of bones in the adult human body': 'Babies are born with about 270 bones; many fuse, leaving 206 in adults.',
  'The longest river in the world (by most measures)': 'The Nile is traditionally cited at about 6,650 km, though the Amazon rivals it depending on how it\'s measured.',
  'The smallest prime number': '2 is the only even prime - every other even number is divisible by 2.',
  'The currency of Japan': 'The yen\'s symbol is ; the name derives from a word meaning "round object".',
  'The artist who painted the Mona Lisa': 'Leonardo da Vinci kept refining the Mona Lisa for years and never delivered it to the client.',
  'The hardest natural substance on Earth': 'Diamond is pure carbon; under different conditions the same atoms form soft graphite.',
  'The speed of light, approximately, in km per second': 'About 299,792 km/s - the universe\'s cosmic speed limit.',
  'The largest ocean on Earth': 'The Pacific covers about a third of the planet\'s surface - more than all land combined.',
  "The gas that makes up most of Earth's atmosphere": 'Nitrogen is about 78% of the air; oxygen is only around 21%.',
  'The capital of Australia (not Sydney)': 'Canberra was purpose-built to settle the Sydney-Melbourne rivalry.',
  'The author of the theory of general relativity': 'Einstein published general relativity in 1915, describing gravity as the curving of spacetime.',
  'The powerhouse of the cell': 'Mitochondria carry their own DNA, a clue they were once independent bacteria.'
};

const decks = JSON.parse(readFileSync(FILE, 'utf8'));
let added = 0, missing = 0;
for (const deck of decks) {
  for (const card of deck.cards) {
    const prompt = card[0];
    const note = NOTES[prompt];
    if (!note) { missing++; console.log('  NO FACTOID for:', prompt); continue; }
    // card tuple is [prompt, answer, accepted, note?]; ensure 'accepted' exists at index 2
    if (card.length < 3) card[2] = [];
    card[3] = note;
    added++;
  }
}
writeFileSync(FILE, JSON.stringify(decks, null, 2) + '\n');
console.log(`\nFactoids: ${added} added, ${missing} without a factoid.`);
