import { director, Color, view, Vec2, AudioClip, View, AudioSourceComponent, Event, Node, game } from "cc";
import { EDITOR } from "cc/env";
import { InputProcessor } from "./event/InputProcessor";
import { RelationType, PopupDirection } from "./FieldTypes";
import { GComponent } from "./GComponent";
import { GGraph } from "./GGraph";
import { Decls, GObject } from "./GObject";
import { UIConfig } from "./UIConfig";
import { UIContentScaler, updateScaler } from "./UIContentScaler";
import { UIPackage } from "./UIPackage";
import { Window } from "./Window";
import { Event as FUIEvent } from "./event/Event";
import { RefMannager } from "./RefManager";

export class GRoot extends GComponent {
    private _modalLayer: GGraph;
    private _popupStack: Array<GObject>;
    private _justClosedPopups: Array<GObject>;
    private _modalWaitPane: GObject;
    private _tooltipWin: GObject;
    private _defaultTooltipWin: GObject;
    private _volumeScale: number;
    private _inputProcessor: InputProcessor;
    private _thisOnResized: () => void;
    private audioEngine: AudioSourceComponent;

    private static _inst: GRoot;

    public static get inst(): GRoot {
        if (!GRoot._inst)
            throw 'Call GRoot.create first!';

        return GRoot._inst;
    }

    public static create(): GRoot {
        GRoot._inst = new GRoot();
        director.getScene().getChildByName('Canvas').addChild(GRoot._inst.node);
        GRoot._inst.onWinResize();

        return GRoot._inst;
    }

    public constructor() {
        super();

        this._node.name = "GRoot";
        this.opaque = false;
        this._volumeScale = 1;
        this._popupStack = new Array<GObject>();
        this._justClosedPopups = new Array<GObject>();

        this._modalLayer = new GGraph();
        this._modalLayer.setSize(this.width, this.height);
        this._modalLayer.drawRect(0, Color.TRANSPARENT, UIConfig.modalLayerColor);
        this._modalLayer.addRelation(this, RelationType.Size);

        this._thisOnResized = this.onWinResize.bind(this);

        this._inputProcessor = this.node.addComponent(InputProcessor);
        this._inputProcessor._captureCallback = this.onTouchBegin_1;

        View.instance.on('design-resolution-changed', this.onWinResize, this);
        if (!EDITOR) {
            View.instance.on('canvas-resize', this._thisOnResized);
            window.addEventListener('orientationchange', this._thisOnResized);
        }
    }

    protected onDestroy(): void {
        View.instance.off('design-resolution-changed', this.onWinResize, this);
        if (!EDITOR) {
            View.instance.off('canvas-resize', this._thisOnResized);
            window.removeEventListener('orientationchange', this._thisOnResized);
        }

        if (this == GRoot._inst)
            GRoot._inst = null;
    }

    public getTouchPosition(touchId?: number): Vec2 {
        return this._inputProcessor.getTouchPosition(touchId);
    }

    public get touchTarget(): GObject {
        return this._inputProcessor.getTouchTarget();
    }

    public get inputProcessor(): InputProcessor {
        return this._inputProcessor;
    }

    public showWindow(win: Window): void {
        this.addChild(win);
        win.requestFocus();

        if (win.x > this.width)
            win.x = this.width - win.width;
        else if (win.x + win.width < 0)
            win.x = 0;

        if (win.y > this.height)
            win.y = this.height - win.height;
        else if (win.y + win.height < 0)
            win.y = 0;

        this.adjustModalLayer();
    }

    public hideWindow(win: Window): void {
        win.hide();
    }

    public hideWindowImmediately(win: Window): void {
        if (win.parent == this)
            this.removeChild(win);

        this.adjustModalLayer();
    }

    public bringToFront(win: Window): void {
        var cnt: number = this.numChildren;
        var i: number;
        if (this._modalLayer.parent && !win.modal)
            i = this.getChildIndex(this._modalLayer) - 1;
        else
            i = cnt - 1;

        for (; i >= 0; i--) {
            var g: GObject = this.getChildAt(i);
            if (g == win)
                return;
            if (g instanceof Window)
                break;
        }

        if (i >= 0)
            this.setChildIndex(win, i);
    }

    public showModalWait(msg?: string): void {
        if (UIConfig.globalModalWaiting != null) {

            if(this._modalWaitPane?.isDisposed) {
                this._modalWaitPane = null;
            }

            if (this._modalWaitPane == null)
                this._modalWaitPane = UIPackage.createObjectFromURL(UIConfig.globalModalWaiting);
            this._modalWaitPane.setSize(this.width, this.height);
            this._modalWaitPane.addRelation(this, RelationType.Size);

            this.addChild(this._modalWaitPane);
            this._modalWaitPane.text = msg;
        }
    }

    public closeModalWait(): void {
        if (this._modalWaitPane && this._modalWaitPane.parent)
            this.removeChild(this._modalWaitPane);
    }

    public closeAllExceptModals(): void {
        var arr: Array<GObject> = this._children.slice();
        var cnt: number = arr.length;
        for (var i: number = 0; i < cnt; i++) {
            var g: GObject = arr[i];
            if ((g instanceof Window) && !g.modal)
                g.hide();
        }
    }

    public closeAllWindows(): void {
        var arr: Array<GObject> = this._children.slice();
        var cnt: number = arr.length;
        for (var i: number = 0; i < cnt; i++) {
            var g: GObject = arr[i];
            if (g instanceof Window)
                g.hide();
        }
    }

    public getTopWindow(): Window {
        var cnt: number = this.numChildren;
        for (var i: number = cnt - 1; i >= 0; i--) {
            var g: GObject = this.getChildAt(i);
            if (g instanceof Window) {
                return g;
            }
        }

        return null;
    }

    public get modalLayer(): GGraph {
        return this._modalLayer;
    }

    public get hasModalWindow(): boolean {
        return this._modalLayer.parent != null;
    }

    public get modalWaiting(): boolean {
        return this._modalWaitPane && this._modalWaitPane.node.activeInHierarchy;
    }

    public getPopupPosition(popup: GObject, target?: GObject, dir?: PopupDirection | boolean, result?: Vec2): Vec2 {
        let pos = result || new Vec2();
        var sizeW: number = 0, sizeH: number = 0;
        if (target) {
            pos = target.localToGlobal();
            let pos2 = target.localToGlobal(target.width, target.height);
            sizeW = pos2.x - pos.x;
            sizeH = pos2.y - pos.y;
        }
        else {
            pos = this.getTouchPosition();
            pos = this.globalToLocal(pos.x, pos.y);
        }

        if (pos.x + popup.width > this.width)
            pos.x = pos.x + sizeW - popup.width;
        pos.y += sizeH;
        if (((dir === undefined || dir === PopupDirection.Auto) && pos.y + popup.height > this.height)
            || dir === false || dir === PopupDirection.Up) {
            pos.y = pos.y - sizeH - popup.height - 1;
            if (pos.y < 0) {
                pos.y = 0;
                pos.x += sizeW / 2;
            }
        }

        return pos;
    }

    public removeChildAt(index: number, dispose?: boolean): GObject {
        let ret = super.removeChildAt(index, dispose);
        
        if(dispose) {
            if(ret == this._modalWaitPane) {
                this._modalWaitPane = null;
            }
        }

        return ret;
    }

    public showPopup(popup: GObject, target?: GObject | null, dir?: PopupDirection | boolean): void {
        if (this._popupStack.length > 0) {
            var k: number = this._popupStack.indexOf(popup);
            if (k != -1) {
                for (var i: number = this._popupStack.length - 1; i >= k; i--)
                    this.removeChild(this._popupStack.pop());
            }
        }
        this._popupStack.push(popup);

        if (target) {
            var p: GObject = target;
            while (p) {
                if (p.parent == this) {
                    if (popup.sortingOrder < p.sortingOrder) {
                        popup.sortingOrder = p.sortingOrder;
                    }
                    break;
                }
                p = p.parent;
            }
        }

        this.addChild(popup);
        this.adjustModalLayer();

        let pt = this.getPopupPosition(popup, target, dir);
        popup.setPosition(pt.x, pt.y);
    }

    public togglePopup(popup: GObject, target?: GObject, dir?: PopupDirection | boolean): void {
        if (this._justClosedPopups.indexOf(popup) != -1)
            return;

        this.showPopup(popup, target, dir);
    }

    public hidePopup(popup?: GObject): void {
        if (popup) {
            var k: number = this._popupStack.indexOf(popup);
            if (k != -1) {
                for (var i: number = this._popupStack.length - 1; i >= k; i--)
                    this.closePopup(this._popupStack.pop());
            }
        }
        else {
            var cnt: number = this._popupStack.length;
            for (i = cnt - 1; i >= 0; i--)
                this.closePopup(this._popupStack[i]);
            this._popupStack.length = 0;
        }
    }

    public get hasAnyPopup(): boolean {
        return this._popupStack.length != 0;
    }

    private closePopup(target: GObject): void {
        if (target.parent) {
            if (target instanceof Window)
                target.hide();
            else
                this.removeChild(target);
        }
    }

    public showTooltips(msg: string): void {
        if (this._defaultTooltipWin == null) {
            var resourceURL: string = UIConfig.tooltipsWin;
            if (!resourceURL) {
                console.error("UIConfig.tooltipsWin not defined");
                return;
            }

            this._defaultTooltipWin = UIPackage.createObjectFromURL(resourceURL);
        }

        this._defaultTooltipWin.text = msg;
        this.showTooltipsWin(this._defaultTooltipWin);
    }

    public showTooltipsWin(tooltipWin: GObject): void {
        this.hideTooltips();

        this._tooltipWin = tooltipWin;

        let pt: Vec2 = this.getTouchPosition();
        pt.x += 10;
        pt.y += 20;

        this.globalToLocal(pt.x, pt.y, pt);

        if (pt.x + this._tooltipWin.width > this.width) {
            pt.x = pt.x - this._tooltipWin.width - 1;
            if (pt.x < 0)
                pt.x = 10;
        }
        if (pt.y + this._tooltipWin.height > this.height) {
            pt.y = pt.y - this._tooltipWin.height - 1;
            if (pt.y < 0)
                pt.y = 10;
        }

        this._tooltipWin.setPosition(pt.x, pt.y);
        this.addChild(this._tooltipWin);
    }

    public hideTooltips(): void {
        if (this._tooltipWin) {
            if (this._tooltipWin.parent)
                this.removeChild(this._tooltipWin);
            this._tooltipWin = null;
        }
    }

    public get volumeScale(): number {
        return this._volumeScale;
    }

    public set volumeScale(value: number) {
        this._volumeScale = value;
    }

    public playOneShotSound(clip: AudioClip, volumeScale?: number): void {
        if (!this.audioEngine) {
            this.audioEngine = this.node.addComponent(AudioSourceComponent);
        }

        if (volumeScale === undefined) volumeScale = 1;

        if (this.audioEngine.isValid) {
            this.audioEngine.clip = clip;
            this.audioEngine.volume = this._volumeScale * volumeScale
            this.audioEngine.loop = false;
            this.audioEngine.play();
        }
    }

    private adjustModalLayer(): void {
        var cnt: number = this.numChildren;

        if (this._modalWaitPane && this._modalWaitPane.parent)
            this.setChildIndex(this._modalWaitPane, cnt - 1);

        for (var i: number = cnt - 1; i >= 0; i--) {
            var g: GObject = this.getChildAt(i);
            if ((g instanceof Window) && g.modal) {
                if (this._modalLayer.parent == null)
                    this.addChildAt(this._modalLayer, i);
                else
                    this.setChildIndexBefore(this._modalLayer, i);
                return;
            }
        }

        if (this._modalLayer.parent)
            this.removeChild(this._modalLayer);
    }

    private onTouchBegin_1(evt: FUIEvent): void {
        if (this._tooltipWin)
            this.hideTooltips();

        this._justClosedPopups.length = 0;
        if (this._popupStack.length > 0) {
            let mc: GObject = evt.initiator;
            while (mc && mc != this) {
                let pindex: number = this._popupStack.indexOf(mc);
                if (pindex != -1) {
                    for (let i: number = this._popupStack.length - 1; i > pindex; i--) {
                        var popup: GObject = this._popupStack.pop();
                        this.closePopup(popup);
                        this._justClosedPopups.push(popup);
                    }
                    return;
                }
                mc = mc.findParent();
            }

            let cnt: number = this._popupStack.length;
            for (let i: number = cnt - 1; i >= 0; i--) {
                popup = this._popupStack[i];
                this.closePopup(popup);
                this._justClosedPopups.push(popup);
            }
            this._popupStack.length = 0;
        }
    }

    public onWinResize(): void {
        updateScaler();

        this.setSize(UIContentScaler.rootSize.width, UIContentScaler.rootSize.height);
        let anchorPoint = this.node.getParent()._uiProps.uiTransformComp.anchorPoint;
        this.node.setPosition(-this._width * anchorPoint.x, this._height * (1 - anchorPoint.y));
    }

    public handlePositionChanged() {
        //nothing here
    }

    protected onUpdate(): void {
        super.onUpdate();

        if(!this._inputProcessor.touching) {
            RefMannager.update(game.frameTime / 1000);
        }
    }
}

Decls.GRoot = GRoot;