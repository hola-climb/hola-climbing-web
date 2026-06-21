// AI technique tag key → Korean UI label mapping
// Add new tags here whenever a new technique key is added to the API

const tagLabels: Record<string, string> = {
  high_step: "하이스텝",
  flagging: "플래깅",
  heel_hook: "힐훅",
  toe_hook: "토훅",
  lock_off: "락오프",
  dyno: "다이노",
  coordination: "코디네이션",
  // drop_knee:     '드롭니',
  // cross_through: '크로스스루',
  // back_step:     '백스텝',
  // smear:         '스미어',
  // crimp:         '크림프',
  // pinch:         '핀치',
  // sloper:        '슬로퍼',
  // undercling:    '언더클링',
  // sidepull:      '사이드풀',
  // compression:   '컴프레션',
  // mantle:        '맨틀',
  dynamic: "다이나믹",
  static: "스태틱",
};

export function getTagLabel(key: string): string {
  return tagLabels[key] ?? key;
}

export default tagLabels;
