import {Injectable} from '@angular/core';
import {Observable} from 'rxjs/Observable';
import {assign} from './utils';
import {ConfigService, IPopupOptions} from './config.service';
import 'rxjs/add/observable/interval';
import 'rxjs/add/observable/fromEvent';
import 'rxjs/add/observable/throw';
import 'rxjs/add/observable/empty';
import 'rxjs/add/observable/merge';
import 'rxjs/add/operator/switchMap';
import 'rxjs/add/operator/take';
import 'rxjs/add/operator/map';

import 'rxjs/add/operator/takeWhile';
import 'rxjs/add/operator/delay';

/**
 * Created by Ron on 17/12/2015.
 */

@Injectable()
export class PopupService {
    url = '';
    popupWindow: Window = null;

    constructor(private config: ConfigService) {}
    open(url: string, name: string, options: IPopupOptions) {
        this.url = url;

        let stringifiedOptions = this.stringifyOptions(this.prepareOptions(options));
        let UA = window.navigator.userAgent;
        let windowName = (this.config.cordova || UA.indexOf('CriOS') > -1) ? '_blank' : name;

        this.popupWindow = window.open(url, '_self', stringifiedOptions);

        window['popup'] = this.popupWindow;

        if (this.popupWindow && this.popupWindow.focus) {
            this.popupWindow.focus();
        }

        return this;
    }

    eventListener(redirectUri: string) {
        return Observable
            .merge(
                Observable.fromEvent(this.popupWindow, 'loadstart')
                .switchMap((event: Event & { url: string }) => {

                    if (!this.popupWindow || this.popupWindow.closed) {
                        return Observable.throw(new Error('Authentication Canceled'));
                    }
                    if (event.url.indexOf(redirectUri) !== 0) {
                        return Observable.empty();
                    }

                    let parser = document.createElement('a');
                    parser.href = event.url;

                    if (parser.search || parser.hash) {
                        const queryParams = parser.search.substring(1).replace(/\/$/, '');
                        const hashParams = parser.hash.substring(1).replace(/\/$/, '');
                        const hash = this.parseQueryString(hashParams);
                        const qs = this.parseQueryString(queryParams);
                        const allParams = assign({}, qs, hash);

                        this.popupWindow.close();

                        if (allParams.error) {
                            throw allParams.error;
                        } else {
                            return Observable.of(allParams);
                        }
                    }
                    return Observable.empty();
                }), Observable.fromEvent<Event>(this.popupWindow, 'exit').delay(100).map(() => {throw new Error('Authentication Canceled')})
                       ).take(1);
    }

    pollPopup() {
        return Observable
            .interval(50)
            .switchMap(() => {
                if (!this.popupWindow || this.popupWindow.closed) {
                    return Observable.throw(new Error('Authentication Canceled'));
                }
                let documentOrigin = document.location.host;
                let popupWindowOrigin = '';
                try {
                    popupWindowOrigin = this.popupWindow.location.host;
                } catch (error) {
                    // ignore DOMException: Blocked a frame with origin from accessing a cross-origin frame.
                    //error instanceof DOMException && error.name === 'SecurityError'
                }
                if (popupWindowOrigin === documentOrigin && (this.popupWindow.location.search || this.popupWindow.location.hash)) {
                    const queryParams = this.popupWindow.location.search.substring(1).replace(/\/$/, '');
                    const hashParams = this.popupWindow.location.hash.substring(1).replace(/[\/$]/, '');
                    const hash = this.parseQueryString(hashParams);
                    const qs = this.parseQueryString(queryParams);
                    this.popupWindow.close();
                    const allParams = assign({}, qs, hash);
                    if (allParams.error) {
                        throw allParams.error;
                    } else {
                        return Observable.of(allParams);
                    }
                }
                return Observable.empty();
            })
            .take(1);
    }

    private prepareOptions(options: IPopupOptions) {
        options = options || {};
        let width = options.width || 500;
        let height = options.height || 500;
        return assign(
            {
                width: width,
                height: height,
                left: window.screenX + ((window.outerWidth - width) / 2),
                top: window.screenY + ((window.outerHeight - height) / 2.5),
                toolbar: options.visibleToolbar ? 'yes': 'no'
            },
            options);
    }

    private stringifyOptions(options: Object) {
        return Object.keys(options).map((key) => {
            return key + '=' + options[key];
        }).join(',');
    }

    private parseQueryString(joinedKeyValue: string): any {
        let key, value;
        return joinedKeyValue.split('&').reduce(
            (obj, keyValue) => {
                if (keyValue) {
                    value = keyValue.split('=');
                    key = decodeURIComponent(value[0]);
                    obj[key] = typeof value[1] !== 'undefined' ? decodeURIComponent(value[1]) : true;
                }
                return obj;
            },
            {});
    }
}
