import { Platform, type TextStyle } from 'react-native';

// The night palette shared with the website: warm black ground, light ink, sparkler gold on actions.
export const colors = {
  primary: '#F2B544', // sparkler gold: buttons and the one highlight per screen
  primaryDark: '#F2B544',
  onPrimary: '#14100A', // text on gold
  purple: '#26221F', // raised panels (was the printed list's purple band)
  gold: '#F2B544',
  green: '#7FD99A', // offer prices and success, readable on the dark ground
  text: '#F2F2F0',
  muted: '#A8A19A',
  border: '#3A3532', // form fields only
  background: '#0F0D0C',
  surface: '#141210',
  surfaceAlt: '#1B1816',
  sectionBg: '#26221F',
  danger: '#FF8A7A',
};

export const fonts = {
  display: 'Gambarino',
  text: 'GeneralSans-Regular',
  textSemi: 'GeneralSans-Medium',
  textBold: 'GeneralSans-Semibold',
};

export const MAX_CONTENT_WIDTH = 1120;
export const WIDE_BREAKPOINT = 760;

/**
 * Text weights. The apps use the platform's own face (SF Pro on iOS, Roboto on Android), as Apple's and
 * Material's guidelines do for interface text: it scales with the reader's text size and reads as native.
 * The website keeps General Sans. Gambarino stays for the brand and large titles everywhere.
 */
const native = (fontWeight: TextStyle['fontWeight']): TextStyle => ({ fontWeight });
export const type = {
  regular: Platform.select<TextStyle>({ web: { fontFamily: fonts.text }, default: native('400') }),
  medium: Platform.select<TextStyle>({ web: { fontFamily: fonts.textSemi }, default: native('500') }),
  semibold: Platform.select<TextStyle>({ web: { fontFamily: fonts.textBold }, default: native('600') }),
  display: { fontFamily: fonts.display } as TextStyle,
};
