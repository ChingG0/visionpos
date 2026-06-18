/*
  把字串轉成 Big5 編碼的「binary string」，給 StarWebPrintBuilder 的 binary:true 模式用。

  背景：印表機的記憶體設定是 Character Mode: T-Chinese，代表它內建字型是用
  Big5 雙位元組碼定址的舊式字型（不是 Unicode 字型）。如果只靠 createTextElement
  的 codepage 屬性貼標籤、卻把 UTF-8 的位元組直接送過去，印表機會照 Big5 的方式
  去解讀那些 UTF-8 位元組，解出來的字完全是另一批字——印出來看起來「正常但全錯」。
  所以一定要真的把文字轉成 Big5 的位元組，再透過 binary 模式送出去。

  iconv-lite 本身是寫給 Node.js 用的，依賴全域的 Buffer，瀏覽器原生沒有這個東西，
  所以這裡用 'buffer' 套件（純 JS、瀏覽器可用的 Buffer polyfill）補上去。
*/
import { Buffer } from 'buffer'
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer
}

import iconv from 'iconv-lite'

export function toBig5BinaryString(text) {
  const bytes = iconv.encode(text, 'big5')
  let result = ''
  for (let i = 0; i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i])
  }
  return result
}