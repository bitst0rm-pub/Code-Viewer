/* jslint esversion:6, strict:global, eqeqeq:false, quotmark:single */
/* globals chrome */

/**
 * @id           $Id$
 * @rev          $Format:%H$ ($Format:%h$)
 * @tree         $Format:%T$ ($Format:%t$)
 * @date         $Format:%ci$
 * @author       $Format:%an$ <$Format:%ae$>
 * @copyright    Copyright (c) 2018-present, Duc Ng. (bitst0rm)
 * @link         https://github.com/bitst0rm
 * @license      The MIT License (MIT)
 */


'use strict';

var headers = {},
    options = {},
    defaults = {
        enabled: true,
        lineWrap: false,
        fontFamily: 'monospace',
        fontSize: null,
        lineHeight: null,
        schedules: [{
            theme: 'default',
            start: '00:00',
            stop: '23:59'
        }],
        blacklist: []
    };

var fs = getDefaultFontSize(defaults.fontFamily);
defaults.fontSize = fs;
defaults.lineHeight = fs * 1.2;

function getDefaultFontSize(fontFamily) {
    var body = document.body,
        pre = document.createElement('pre');
    pre.style.display = 'inline-block';
    pre.style.fontFamily = fontFamily;
    pre.style.fontSize = '1rem';
    pre.style.lineHeight = '1';
    pre.style.padding = '0';
    pre.style.position = 'absolute';
    pre.style.visibility = 'hidden';
    pre.appendChild(document.createTextNode('M'));
    body.appendChild(pre);
    var fs = pre.offsetHeight;
    body.removeChild(pre);
    return fs;
}

function copy(source) {
    var target = JSON.parse(JSON.stringify(source));
    return target;
}

function extend(target, source) {
    for (let key of Object.keys(source)) {
        if (source[key] instanceof Object) {
            Object.assign(source[key], extend(target[key], source[key]));
        }
    }
    Object.assign(target || {}, source);
    return target;
}

function getOptions() {
    chrome.storage.sync.get('options', function(data) {
        options = copy(defaults);
        if (data.hasOwnProperty('options')) {
            options = extend(options, data.options);
        }
        refreshIcon(options.enabled);
    });
}

chrome.storage.onChanged.addListener(function(changes, areaName) {
    getOptions();
});

function refreshIcon(isON) {
    var s = isON ? 'on' : 'off';
    var p = {
        '16': 'images/' + s + '/16.png',
        '32': 'images/' + s + '/32.png',
        '64': 'images/' + s + '/64.png',
        '128': 'images/' + s + '/128.png',
        '256': 'images/' + s + '/256.png'
    };
    chrome.browserAction.setIcon({
        path: p
    });
}

chrome.browserAction.onClicked.addListener(function() {
    options.enabled = options.enabled ? false : true;
    refreshIcon(options.enabled);
});

chrome.webRequest.onHeadersReceived.addListener(
    function(details) {
        if (Number(details.tabId) > 0) {
            headers[details.tabId] = details;
        }
    }, {
        urls: ['http://*/*', 'https://*/*'],
        types: ['main_frame']
    }, ['responseHeaders']
);

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    var tabId = ('tab' in sender && Number(sender.tab.id) > 0) ? sender.tab.id : null;

    switch (message.action) {
        case 'get_headers':
            sendResponse(headers[tabId]);
            return true;
        case 'export_options':
        case 'get_options':
            sendResponse(options);
            return true;
        case 'get_defaults':
        case 'reset_options':
            sendResponse(defaults);
            return true;
        case 'insert_base_css':
            chrome.tabs.insertCSS(tabId, {
                file: 'codemirror/lib/codemirror.css'
            }, function() {
                chrome.tabs.insertCSS(tabId, {
                    file: 'css/content.css'
                }, sendResponse);
            });
            return true;
        case 'insert_theme':
            if (message.theme === 'default') {
                sendResponse({});
            } else {
                chrome.tabs.insertCSS(tabId, {
                    file: 'codemirror/theme/' + message.theme + '.css'
                }, sendResponse);
            }
            return true;
        case 'insert_css':
            chrome.tabs.insertCSS(tabId, {
                code: message.css
            }, sendResponse);
            return true;
    }
});

chrome.tabs.onRemoved.addListener(function(tabId) {
    delete headers[tabId];
});

getOptions();
