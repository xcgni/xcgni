// Shared option lists for demographic dropdowns, so onboarding, settings, and the public
// breakdowns all agree on the same canonical values (free-text fragments the data).

export const COUNTRIES = [
  'Australia', 'Austria', 'Belgium', 'Brazil', 'Bulgaria', 'Canada', 'China', 'Croatia',
  'Czechia', 'Denmark', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'India',
  'Indonesia', 'Ireland', 'Israel', 'Italy', 'Japan', 'Mexico', 'Netherlands', 'New Zealand',
  'Nigeria', 'Norway', 'Pakistan', 'Philippines', 'Poland', 'Portugal', 'Romania', 'Russia',
  'Serbia', 'Singapore', 'Slovakia', 'Slovenia', 'South Africa', 'South Korea', 'Spain',
  'Sweden', 'Switzerland', 'Turkey', 'Ukraine', 'United Kingdom', 'United States', 'Other'
];

export const LANGUAGES = [
  'Arabic', 'Bengali', 'Bosnian', 'Bulgarian', 'Chinese', 'Croatian', 'Czech', 'Danish',
  'Dutch', 'English', 'Finnish', 'French', 'German', 'Greek', 'Hebrew', 'Hindi', 'Hungarian',
  'Indonesian', 'Italian', 'Japanese', 'Korean', 'Norwegian', 'Polish', 'Portuguese',
  'Romanian', 'Russian', 'Serbian', 'Slovak', 'Slovenian', 'Spanish', 'Swedish', 'Turkish',
  'Ukrainian', 'Other'
];

// Age bands as canonical values; we store the band directly (privacy-friendlier than a
// precise birth year, and it matches how the breakdowns group).
export const AGE_BANDS = ['under 18', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];

export const EDUCATION = [
  { value: 'secondary', label: 'Secondary' },
  { value: 'vocational', label: 'Vocational' },
  { value: 'bachelor', label: "Bachelor's" },
  { value: 'master', label: "Master's" },
  { value: 'doctorate', label: 'Doctorate' }
];

export const HANDEDNESS = [
  { value: 'right', label: 'Right' },
  { value: 'left', label: 'Left' },
  { value: 'ambidextrous', label: 'Ambidextrous' }
];
