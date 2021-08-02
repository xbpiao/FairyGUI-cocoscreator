namespace fgui {

    export interface IUISource {
        fileName: string;
        loaded: boolean;
        /**本次加载失败 */
        failed: boolean;
        /**本次加载成功 */
        succeed: boolean;

        load(callback: Function, target: any, atlases?: number[]): void;
        fail(callback: Function, target: any): void;
    }
}