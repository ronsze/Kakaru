/**
 * 설정 창 IPC 채널 이름.
 * 오버레이 preload(index)와 설정 preload(settings)가 같은 모듈을 가져오면 번들러가 공유 청크를 만드는데,
 * 샌드박스된 preload는 상대 경로 require를 못 하므로 채널 상수를 별도 파일로 나눠 청크가 생기지 않게 한다.
 */
export const CHANNEL_CHARACTERS_LIST = 'characters:list'
export const CHANNEL_CHARACTERS_VALIDATE = 'characters:validate'
export const CHANNEL_CHARACTERS_REGISTER = 'characters:register'
export const CHANNEL_CHARACTERS_APPLY = 'characters:apply'
export const CHANNEL_CHARACTERS_DELETE = 'characters:delete'
export const CHANNEL_CHARACTERS_CHANGED = 'characters:changed'
export const CHANNEL_CHARACTERS_EXPORT = 'characters:export'
export const CHANNEL_CHARACTERS_IMPORT = 'characters:import'
export const CHANNEL_LINES_GET = 'lines:get'
export const CHANNEL_LINES_SAVE = 'lines:save'
export const CHANNEL_LINES_RESTORE = 'lines:restore'
