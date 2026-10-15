// Stable term keys: "Non-compete radius" → "custom_noncompete_radius"
export const toTermKey = (name: string, custom: boolean): string => {
  const base =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\w\s]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 60) || 'term';
  return custom ? `custom_${base}` : base;
};
