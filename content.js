/* jslint esversion:6, strict:global, eqeqeq:false, quotmark:single */
/* globals chrome, CodeMirror */

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

chrome.runtime.sendMessage({
    action: 'get_headers'
}, function(headers) {
    chrome.runtime.sendMessage({
        action: 'get_options'
    }, function(options) {
        if (!options.enabled) return;
        options = detectCurrentTheme(options);

        if (headers && Object.keys(headers).length > 0 && headers.responseHeaders.length > 0) {
            headers.mime = null;
            for (var i = 0; i < headers.responseHeaders.length; i++) {
                var field = headers.responseHeaders[i];
                if (field.name === 'Content-Type' && field.value.length > 0) {
                    var m = /^\s*([^;\s]*)(?:;|\s|$)/.exec(field.value);
                    if (m) {
                        headers.mime = m[1];
                        break;
                    }
                }
            }
            codeView(headers, options);
        } else {
            codeView({
                url: document.location.href,
                mime: null
            }, options);
        }
    });
});

function codeView(headers, options) {
    var url = null,
        ext = null,
        info = null,
        mode = null,
        mime = null,
        mimes = null,
        alias = null,
        target = null;

    url = headers.url || document.location.href;
    ext = getExtensionFromUrl(url);

    if (ext) {
        info = CodeMirror.findModeByExtension(ext);
    } else if (/\//.test(headers.mime)) {
        info = CodeMirror.findModeByMIME(headers.mime);
    } else {
        return;
    }

    if (info) {
        mode = 'mode' in info ? info.mode : null;
        mime = 'mime' in info ? info.mime : null;
        mimes = 'mimes' in info ? info.mimes : [];
        alias = 'alias' in info ? info.alias : [];
    } else {
        return;
    }

    mimes.push(mime);
    var unique = Array.from(new Set(mimes.concat(alias)));
    unique.push(ext);

    for (var i = 0; i < options.blacklist.length; i++) {
        var pattern = new RegExp(options.blacklist[i]);
        for (var j = 0; j < unique.length; j++) {
            if (pattern.test(unique[j])) {
                return;
            }
        }
    }

    target = getTargetElement(document.body);

    if (mode && target) {
        chrome.runtime.sendMessage({
            action: 'insert_base_css'
        }, function() {
            applyEditor(target.innerText, mode, target, options);
        });
    }
}

function detectCurrentTheme(options) {
    var now = new Date(),
        hh = now.getHours(),
        mm = now.getMinutes(),
        pattern = /^(\d+):(\d+)$/,
        schedules = options.schedules;
    for (var i = 0; i < schedules.length; i++) {
        var a = convertTime(schedules[i].start).match(pattern),
            startHH = Number(a[1]),
            startMM = Number(a[2]);
        var b = convertTime(schedules[i].stop).match(pattern),
            stopHH = Number(b[1]),
            stopMM = Number(b[2]);
        if (hh >= startHH && hh <= stopHH && mm >= startMM && mm <= stopMM) {
            options.theme = schedules[i].theme;
            return options;
        }
    }
    options.theme = 'default';
    return options;
}

function convertTime(time) {
    var meridiem = time.match(/\s?(AM|PM)?$/i)[1];
    if (!meridiem) {
        return time;
    } else {
        var hh = Number(time.match(/^(\d+)/)[1]);
        var mm = Number(time.match(/:(\d+)/)[1]);
        if (meridiem === 'pm' && hh < 12) hh = hh + 12;
        if (meridiem === 'am' && hh === 12) hh = hh - 12;
        return hh.toString() + ':' + mm.toString();
    }
}

function getExtensionFromUrl(url) {
    return url.split(/\#|\?/)[0].split('.').pop().trim().toLowerCase();
}

function getTargetElement(bodyElement) {
    if (bodyElement) {
        var children = bodyElement.children;
        if (children.length > 0 && children[0].tagName === 'PRE' && !document.doctype) {
            return children[0];
        }
    }
    return null;
}

function applyEditor(text, mode, output, options) {
    chrome.runtime.sendMessage({
        action: 'insert_theme',
        theme: options.theme.split(' ')[0]
    }, function() {
        var wrapper = document.createElement('div');
        wrapper.className = 'CodeMirror cm-s-' + options.theme.split(' ').join(' cm-s-') + (options.lineWrap ? ' CodeMirror-wrap' : '');
        wrapper.style.fontFamily = options.fontFamily;
        wrapper.style.fontSize = options.fontSize + 'px';
        wrapper.style.lineHeight = options.lineHeight + 'px';
        output.parentNode.replaceChild(wrapper, output);

        var gutters = document.createElement('div');
        gutters.className = 'CodeMirror-gutters';
        wrapper.appendChild(gutters);

        var gutter = document.createElement('div');
        gutter.className = 'CodeMirror-gutter CodeMirror-linenumbers';
        gutters.appendChild(gutter);

        var linenum = document.createElement('div');
        linenum.className = 'CodeMirror-linenumber';
        gutter.appendChild(linenum);

        var code = document.createElement('div');
        code.className = 'CodeMirror-lines';
        code.setAttribute('role', 'presentation');
        wrapper.appendChild(code);

        var table = document.createElement('table');
        table.className = 'CodeMirror-code';
        table.setAttribute('role', 'presentation');
        code.appendChild(table);

        var colGroup = document.createElement('colgroup');
        var colNumber = document.createElement('col');
        var colContent = document.createElement('col');
        colNumber.className = 'line-number';
        colContent.className = 'line-content';
        colGroup.appendChild(colNumber);
        colGroup.appendChild(colContent);
        table.appendChild(colGroup);

        var lineNumber = 0;
        var frag = document.createDocumentFragment();
        var row, lineNumCell, lineNumElem, lineCntCell, spanWrapper, pre;

        function appendLine(contents) {
            lineNumber++;
            row = table.insertRow();
            lineNumCell = row.insertCell(0);
            lineNumCell.className = 'CodeMirror-gutter-wrapper';
            lineNumElem = document.createElement('div');
            lineNumElem.className = 'CodeMirror-linenumber CodeMirror-gutter-elt';
            lineNumElem.dataset.n = lineNumber;
            lineNumCell.appendChild(lineNumElem);
            lineCntCell = row.insertCell(1);
            lineCntCell.className = 'line-wrapper';
            if (contents.childNodes.length !== 0) {
                pre = document.createElement('pre');
                pre.className = 'CodeMirror-line';
                pre.setAttribute('role', 'presentation');
                lineCntCell.appendChild(pre);

                spanWrapper = document.createElement('span');
                spanWrapper.style = 'padding-right: 0.1px;';
                spanWrapper.setAttribute('role', 'presentation');
                pre.appendChild(spanWrapper);

                spanWrapper.appendChild(contents);
            }
            frag = document.createDocumentFragment();
        }

        var callback = function(string, style) {
            if (/\r?\n|\r/.test(string)) {
                appendLine(frag);
            } else if (style) {
                var span = document.createElement('span');
                span.className = 'cm-' + style;
                span.appendChild(document.createTextNode(string));
                frag.appendChild(span);
            } else {
                frag.appendChild(document.createTextNode(string));
            }
        };

        CodeMirror.runMode(text, mode, callback);
        appendLine(frag);
        linenum.dataset.n = lineNumber;
        colNumber.style.width = gutters.offsetWidth + 'px';
        setActiveline();
    });
}

function setActiveline() {
    var activeline;

    function removeActiveline() {
        if (activeline) {
            activeline.classList.remove('CodeMirror-activeline', 'CodeMirror-activeline-background');
            activeline.cells[0].classList.add('CodeMirror-activeline-gutter');
            activeline = null;
        }
    }
    document.addEventListener('click', function(event) {
        var tr = event.target.closest('tr');
        if (!tr || window.getSelection().toString()) return;
        removeActiveline();
        tr.classList.add('CodeMirror-activeline', 'CodeMirror-activeline-background');
        tr.cells[0].classList.add('CodeMirror-activeline-gutter');
        activeline = tr;
    }, false);
    document.addEventListener('dblclick', removeActiveline, false);
    document.addEventListener('selectstart', removeActiveline, false);
}
