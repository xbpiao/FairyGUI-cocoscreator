export class RefMannager {
    static deleteItem(item) {
        this._deletes.push(item);
    }
    static update(dt) {
        this._timer += dt;
        if (this._timer >= 10) {
            this._timer = 0;
            for (let i = this._deletes.length - 1; i >= 0; i--) {
                let item = this._deletes[i];
                if (item.ref <= 0) {
                    this._deletes.splice(i, 1);
                    item.doRelease();
                }
            }
        }
    }
}
RefMannager._timer = 0;
RefMannager._deletes = [];
