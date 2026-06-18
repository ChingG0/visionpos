/* 標籤顏色：淺色系 8 色，settings 跟 order 共用 */
export const TAG_COLORS = [
  { id: 'red',    label: '紅', bg: '#fbdcdc', text: '#a83c3c' },
  { id: 'orange', label: '橙', bg: '#fbe3cc', text: '#b8631f' },
  { id: 'yellow', label: '黃', bg: '#fbf0c2', text: '#9c7a14' },
  { id: 'green',  label: '綠', bg: '#dcf0dc', text: '#2f7a3d' },
  { id: 'blue',   label: '藍', bg: '#d8e6fa', text: '#2f5fa8' },
  { id: 'purple', label: '紫', bg: '#e8dcf5', text: '#6b3fa0' },
  { id: 'white',  label: '白', bg: '#ffffff', text: '#5a5650', border: '#d8d0c0' },
  { id: 'gray',   label: '灰', bg: '#e6e2da', text: '#5a5650' },
]

export const TAG_COLOR_MAP = TAG_COLORS.reduce((map, c) => {
  map[c.id] = c
  return map
}, {})