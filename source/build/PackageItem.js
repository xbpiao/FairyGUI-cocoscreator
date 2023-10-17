import { assetManager } from "cc";
import { PackageItemType } from "./FieldTypes";
import { UIContentScaler } from "./UIContentScaler";
import { UIConfig } from "./UIConfig";
import { RefMannager } from "./RefManager";
export class PackageItem {
    get ref() {
        return this._ref;
    }
    constructor() {
        this.width = 0;
        this.height = 0;
        this.__loaded = false;
        this._ref = 0;
    }
    load() {
        return this.owner.getItemAsset(this);
    }
    loadAsync() {
        return this.owner.getItemAssetAsync2(this);
    }
    getBranch() {
        if (this.branches && this.owner._branchIndex != -1) {
            var itemId = this.branches[this.owner._branchIndex];
            if (itemId)
                return this.owner.getItemById(itemId);
        }
        return this;
    }
    getHighResolution() {
        if (this.highResolution && UIContentScaler.scaleLevel > 0) {
            var itemId = this.highResolution[UIContentScaler.scaleLevel - 1];
            if (itemId)
                return this.owner.getItemById(itemId);
        }
        return this;
    }
    toString() {
        return this.name;
    }
    addRef() {
        var _a, _b;
        this._ref++;
        (_a = this.parent) === null || _a === void 0 ? void 0 : _a.addRef();
        (_b = this.asset) === null || _b === void 0 ? void 0 : _b.addRef();
        switch (this.type) {
            case PackageItemType.MovieClip:
                if (this.frames) {
                    for (var i = 0; i < this.frames.length; i++) {
                        var frame = this.frames[i];
                        if (frame.texture) {
                            frame.texture.addRef();
                        }
                        if (frame.altasPackageItem) {
                            frame.altasPackageItem.addRef();
                        }
                    }
                }
                break;
        }
    }
    doRelease() {
        switch (this.type) {
            case PackageItemType.MovieClip:
                if (this.frames) {
                    for (var i = 0; i < this.frames.length; i++) {
                        var frame = this.frames[i];
                        if (frame.texture) {
                            frame.texture.decRef(true);
                            if (UIConfig.autoReleaseAssets) {
                                if (frame.texture.refCount == 0) {
                                    assetManager.releaseAsset(frame.texture);
                                }
                            }
                        }
                        if (frame.altasPackageItem) {
                            frame.altasPackageItem.decRef();
                        }
                    }
                }
                break;
        }
        if (UIConfig.autoReleaseAssets) {
            if (this.asset && this.asset.refCount == 0) {
                assetManager.releaseAsset(this.asset);
            }
            if (this._ref == 0) {
                this.__loaded = false;
                this.decoded = false;
                this.frames = null;
                this.asset = null;
                this.parent = null;
            }
        }
    }
    decRef() {
        var _a, _b;
        if (this._ref > 0) {
            this._ref--;
        }
        else {
            return;
        }
        (_a = this.parent) === null || _a === void 0 ? void 0 : _a.decRef();
        (_b = this.asset) === null || _b === void 0 ? void 0 : _b.decRef(false);
        if (this._ref <= 0) {
            RefMannager.deleteItem(this);
        }
    }
    dispose(force = false) {
        if (this.asset) {
            if (force) {
                assetManager.releaseAsset(this.asset);
            }
            else {
                this.asset.decRef(true);
            }
            this.asset = null;
        }
    }
}
