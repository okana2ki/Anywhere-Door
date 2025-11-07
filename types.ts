// AppState に画像表示後、動画生成中、動画表示中の状態を追加
export type AppState = 'IDLE' | 'READY' | 'AWAITING_LOCATION' | 'GENERATING_IMAGE' | 'IMAGE_DISPLAYED' | 'GENERATING_AERIAL_IMAGES' | 'AERIAL_IMAGES_DISPLAYED' | 'AWAITING_TRANSLATION_INPUT' | 'TRANSLATING' | 'ERROR';

export type ViewType = 'street' | 'satellite';
