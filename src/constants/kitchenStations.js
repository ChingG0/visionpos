// 工作站（出餐區）固定清單。
// 目前先寫死 3 個區域（炒台/冷食/飲料），跟商品管理的「工作站」多選欄位、
// 後台工作站頁面的分頁、出單設定的「此區不要印單」都共用同一份清單。
export const KITCHEN_STATIONS = [
  { id: 'wok',   label: '炒台' },
  { id: 'cold',  label: '冷食' },
  { id: 'drink', label: '飲料' },
]

export function stationLabel(id) {
  return KITCHEN_STATIONS.find(s => s.id === id)?.label ?? id
}
