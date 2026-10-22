import { contextBridge } from 'electron'

// 설정 창에 노출하는 API. 이후 스토리에서 list/validate/register/apply/delete를 추가한다.
contextBridge.exposeInMainWorld('kakaruSettings', {})
