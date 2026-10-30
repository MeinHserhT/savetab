export type ThemeMode = 'dark' | 'light';

export interface PaletteColorSwatch {
  role: 'Canvas' | 'Primary' | 'Accent' | 'Highlight';
  labelVi: string;
  hex: string;
  swatchClass: string;
}

export interface ThemePalette {
  id: string;
  name: string;
  mode: ThemeMode;
  /**
   * 4 main colors of the interface:
   * Light: #FFFAFF (Canvas), #0A2463 (Royal Navy Ink/Structure), #3E92CC (Celestial Blue), #D8315B (Cerise Crimson)
   * Dark:  #061539 (Deep Navy Canvas), #0A2463 (Royal Navy Surface), #FFFAFF (Snow White Ink), #5AA9E6 / #FF4D79 (Luminous Blue & Cerise)
   */
  mainColors: [
    PaletteColorSwatch,
    PaletteColorSwatch,
    PaletteColorSwatch,
    PaletteColorSwatch,
  ];
}

export const LIGHT_PALETTE: ThemePalette = {
  id: 'light',
  name: 'Royal Cerise Light',
  mode: 'light',
  mainColors: [
    {
      role: 'Canvas',
      labelVi: 'Nền trắng ánh tuyết',
      hex: '#FFFAFF',
      swatchClass: 'bg-[#FFFAFF]',
    },
    {
      role: 'Primary',
      labelVi: 'Xanh Navy đậm',
      hex: '#0A2463',
      swatchClass: 'bg-[#0A2463]',
    },
    {
      role: 'Accent',
      labelVi: 'Xanh lam sáng',
      hex: '#3E92CC',
      swatchClass: 'bg-[#3E92CC]',
    },
    {
      role: 'Highlight',
      labelVi: 'Đỏ hồng Cerise',
      hex: '#D8315B',
      swatchClass: 'bg-[#D8315B]',
    },
  ],
};

export const DARK_PALETTE: ThemePalette = {
  id: 'dark',
  name: 'Obsidian Ice Dark',
  mode: 'dark',
  mainColors: [
    {
      role: 'Canvas',
      labelVi: 'Đen tuyền nền chính',
      hex: '#090A0D',
      swatchClass: 'bg-[#090A0D]',
    },
    {
      role: 'Primary',
      labelVi: 'Xám than bề mặt',
      hex: '#12141A',
      swatchClass: 'bg-[#12141A]',
    },
    {
      role: 'Accent',
      labelVi: 'Xám viền & phụ trợ',
      hex: '#262A34',
      swatchClass: 'bg-[#262A34]',
    },
    {
      role: 'Highlight',
      labelVi: 'Trắng ánh xanh',
      hex: '#F0F7FF',
      swatchClass: 'bg-[#F0F7FF]',
    },
  ],
};

export function getPaletteForMode(mode: ThemeMode): ThemePalette {
  return mode === 'light' ? LIGHT_PALETTE : DARK_PALETTE;
}
