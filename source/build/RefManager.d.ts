type Item = {
    ref: number;
    addRef(): void;
    decRef(): void;
    doRelease(): void;
};
export declare class RefMannager {
    private static _timer;
    private static _deletes;
    static deleteItem(item: Item): void;
    static update(dt: number): void;
}
export {};
