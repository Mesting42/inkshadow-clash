/** 图标与技能特效共用轮廓数据，确保掌印、疾影和震波形状一致。 */
export const SKILL_GLYPHS: Record<string, string> = {
  palm: 'M13 48V25l6-2 6 12V14l7-1 3 20V8h7l1 26 4-19 7 3-5 22 6-9 7 4-8 20-13 11H26z',
  shadow: 'M5 44l31-15L63 5 44 37l20-5-37 33 9-24z',
  quake: 'M28 8h16l5 24-13 11-13-11zM7 49l22-9-5 9 12-4 12 4-5-9 22 9 5 15-22-8-12 11-12-11-22 8z',
};
/** 本地彩色徽记：商品、武器和构筑共享同一套实心轮廓与材质语言。 */
export function icon(id: string, color = '#e8b783', size = 72) {
  const shapes: Record<string, string> = {
    fist: '<path d="M24 48V29q0-9 7-7v-5q0-6 6-4l3 11v-7q0-7 7-3l3 13q6-2 7 5l-1 16-10 13H31z"/><path d="M23 36l-8-5-2 12 14 16 7-8z"/>',
    baton: '<path d="M18 55L49 15q5-5 9 0t-1 8L24 62z"/><path d="M17 48l15 11-4 5-15-11z" fill="#263541"/>',
    staff: '<path d="M13 58L54 9l5 4-41 49z"/><path d="M48 11l8-7 8 7-7 8zM7 56l8-5 9 8-8 8z" fill="#d9d9be"/>',
    hammer: '<path d="M15 58l25-35 7 5-24 36z" fill="#b68d60"/><path d="M30 14l14-10 25 22-13 15z" fill="#a7b4bb"/><path d="M32 13l24 22 8-8-25-21z"/><path d="M41 10l17 15-5 5-17-15z" fill="#e2c68e"/>',
    blades: '<path d="M14 55l9-20L54 7l-8 23-26 31zM41 56l-9-20L10 10l3 24 25 29z" fill="#c7d6dc"/><path d="M11 50l17 10-4 6L8 56zM32 61l17-10 3 6-16 10z"/>',
    blade: '<path d="M15 55L55 7l-8 26-27 28z" fill="#c8d5dc"/><path d="M8 52l20 9-4 6-20-9z"/>',
    discs: '<circle cx="36" cy="36" r="23" fill="#354854"/><path d="M36 7l7 13 15-1-2 15 11 10-15 5-6 15-11-11-15 2 1-15L8 33l15-6z"/><circle cx="36" cy="36" r="9" fill="#263541"/>',
    disc: '<circle cx="36" cy="36" r="24"/><circle cx="36" cy="36" r="15" fill="#263541"/><circle cx="36" cy="36" r="5"/>',
    burst: '<path d="M36 4l6 20 20-10-12 18 18 8-22 5 5 21-15-16-13 16 2-23-22-3 21-10-8-19 17 14z"/>',
    flow: '<path d="M15 20q23-18 43 4L45 37l-1-12q-16-11-28 3zM57 51Q34 69 14 47l13-13 1 12q16 11 28-3z"/>',
    shield: '<path d="M36 6l24 9-3 27q-3 15-21 25Q18 57 15 42l-3-27z"/><path d="M36 18l12 5-2 18-10 13-10-13-2-18z" fill="#2b3d4a"/>',
    wing: '<path d="M8 14l26 19L65 6 51 35 38 42l13-3-13 16-15 10 4-22L15 31z"/>',
    shadow: '<path d="M5 44l31-15L63 5 44 37l20-5-37 33 9-24z"/><path d="M4 20h24l-7 5H1zM3 33h18l-5 5H1z" opacity=".5"/>',
    crest: '<path d="M36 5l10 14 17 2-9 15 2 20-20-5-20 5 2-20-9-15 17-2z"/><path d="M36 20l10 15-10 12-10-12z" fill="#35424b"/>',
    heart: '<path d="M36 63L12 38Q1 20 16 13q14-5 20 8 7-13 20-8 15 7 4 25z"/>',
    box: '<path d="M10 23l26-14 26 14v30L36 67 10 53z"/><path d="M10 23l26 14 26-14M36 37v30" stroke="#344550" stroke-width="4" fill="none"/><path d="M24 16l25 15v12l-8 5V36L16 21z" fill="#eed5a2"/>',
    palm: '<path d="M13 48V25l6-2 6 12V14l7-1 3 20V8h7l1 26 4-19 7 3-5 22 6-9 7 4-8 20-13 11H26z"/><path d="M8 55l-6-6M12 13L7 7M62 10l-5 8" stroke="#efce9e" stroke-width="3"/>',
    quake: '<path d="M28 8h16l5 24-13 11-13-11zM7 49l22-9-5 9 12-4 12 4-5-9 22 9 5 15-22-8-12 11-12-11-22 8z"/>',
    coin: '<circle cx="36" cy="36" r="25"/><circle cx="36" cy="36" r="18" fill="#927048"/><path d="M30 23h12v26H30z"/>',
    repair: '<path d="M45 8q18-3 19 15l-12 9-8-8 8-10q-13 1-14 17L10 59l-8-8 28-29Q30 8 45 8z"/>',
  };
  return `<svg class="art-icon" width="${size}" height="${size}" viewBox="0 0 72 72" aria-hidden="true"><ellipse cx="36" cy="61" rx="23" ry="5" fill="#0c182b55"/><g fill="${color}">${SKILL_GLYPHS[id] ? `<path d="${SKILL_GLYPHS[id]}"/>` : shapes[id] || shapes.crest}</g></svg>`;
}
export const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>';
export const pauseIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="3"/></svg>';
