type Item = {
    ref: number;
    addRef(): void;
    decRef(): void;
    doRelease(): void;
}

export class RefMannager {
    private static _timer: number = 0;
    private static _deletes: Array<Item> = [];

    public static deleteItem(item: Item): void {
        this._deletes.push(item);
    }

    public static update(dt: number) {
        this._timer += dt;
        if(this._timer >= 10) {
            this._timer = 0;
            for(let i=this._deletes.length-1;i>=0;i--) {
                let item = this._deletes[i];
                if(item.ref<=0) {
                    this._deletes.splice(i,1);
                    item.doRelease();
                }
            }
        }
    }
}