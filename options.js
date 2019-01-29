/* jslint esversion:5, strict:global, eqeqeq:false, quotmark:single */
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


(function(d) {
    'use strict';

    var $ = {
        init: function() {
            $.action.load();
        },
        action: {
            load: function() {
                d.addEventListener('DOMContentLoaded', function() {
                    chrome.runtime.sendMessage({
                        action: 'get_options'
                    }, function(options) {
                        $.action.setButtons(options);
                        $.layout.getNativeStyle();
                        $.showOptions(options);
                        d.getElementById('version').textContent = 'version ' + $.showVersion();
                    });

                    $.action.export();
                    $.action.import();
                    $.action.reset();
                    $.action.save();
                });
            },
            export: function() {
                d.getElementById('export').addEventListener('click', function() {
                    chrome.runtime.sendMessage({
                        action: 'export_options'
                    }, function(options) {
                        $.layout.setNativeStyle();

                        var now = new Date(),
                            date = [
                                now.getFullYear(),
                                '-',
                                ('0' + (now.getMonth() + 1)).slice(-2),
                                '-',
                                ('0' + now.getDate()).slice(-2),
                                '_',
                                ('0' + now.getHours()).slice(-2),
                                '.',
                                ('0' + now.getMinutes()).slice(-2),
                                '.',
                                ('0' + now.getSeconds()).slice(-2)
                            ].join('');

                        var blob = new Blob([JSON.stringify(options)], {
                            type: 'application/json'
                        });
                        var url = URL.createObjectURL(blob);

                        chrome.downloads.download({
                            url: url,
                            filename: 'code-viewer-prefs_' + date + '.json',
                            conflictAction: 'prompt'
                        }, function(downloadId) {
                            var fn = null;

                            function callback(delta) {
                                if (delta.id === downloadId) {
                                    if (delta.filename && delta.filename.current) {
                                        fn = delta.filename.current;
                                    }
                                    if (delta.state && delta.state.current === chrome.downloads.State.COMPLETE) {
                                        $.showMessage('Options exported' + (fn ? ' to ' + fn : ''));
                                        chrome.downloads.onChanged.removeListener(callback);
                                    }
                                }
                            }
                            chrome.downloads.onChanged.addListener(callback);
                        });
                    });
                });
            },
            import: function() {
                d.getElementById('import').addEventListener('click', function() {
                    $.layout.setNativeStyle();

                    var input = document.createElement('input');
                    input.type = 'file';
                    input.style.display = 'none';
                    input.focus();

                    function listener() {
                        var file = input.files[0],
                            reader = new FileReader();
                        reader.onload = function(e) {
                            var string = e.target.result,
                                options = null;
                            try {
                                options = JSON.parse(string);
                            } catch (err) {
                                $.showMessage(err + ' in ' + file.name, true);
                            } finally {
                                if (options) {
                                    chrome.runtime.sendMessage({
                                        action: 'get_defaults'
                                    }, function(defaults) {
                                        if ($.action.isValidJSON(defaults, options, file)) {
                                            $.action.refresh(options);
                                            $.showMessage('Options restored');
                                        }
                                    });
                                }
                            }
                        };
                        reader.readAsText(file);
                        input.removeEventListener('change', listener);
                    }

                    input.addEventListener('change', listener);
                    input.click();
                    input.blur();
                    input.remove();
                });
            },
            reset: function() {
                d.getElementById('reset').addEventListener('click', function() {
                    chrome.runtime.sendMessage({
                        action: 'reset_options'
                    }, function(options) {
                        $.action.refresh(options);
                        $.layout.setNativeStyle();
                        $.showMessage('Options have been reset to default values');
                    });
                });
            },
            save: function() {
                d.getElementById('save').addEventListener('click', function() {
                    $.layout.setNativeStyle();

                    var opt = {};
                    opt.enabled = d.getElementById('enabled').checked;
                    opt.lineWrap = d.getElementById('line-wrap').checked;
                    opt.fontFamily = d.getElementById('font-family').value;
                    opt.fontSize = d.getElementById('font-size').value;
                    opt.lineHeight = d.getElementById('line-height').value;

                    opt.schedules = [];
                    var section = d.getElementById('theme-section');
                    for (i = 0; i < section.children.length; i++) {
                        var o = {};
                        var menus = section.getElementsByClassName('theme-menu');
                        o.theme = menus[i].options[menus[i].selectedIndex].text;
                        var start = section.getElementsByClassName('start');
                        o.start = start[i].value;
                        var stop = section.getElementsByClassName('stop');
                        o.stop = stop[i].value;
                        opt.schedules.push(o);
                    }

                    opt.blacklist = [];
                    var lines = d.getElementById('blacklist').value.split('\n');
                    for (var i = 0; i < lines.length; i++) {
                        if (lines[i].trim().length > 0) {
                            opt.blacklist.push(lines[i]);
                        }
                    }

                    chrome.runtime.sendMessage({
                        action: 'get_defaults'
                    }, function(defaults) {
                        var data = $.validateOptions(defaults, opt);
                        if (data.isValid) {
                            $.setOptions(data.options);
                            $.showMessage('Options saved');
                        } else {
                            $.showOptions(data.options);
                            $.showMessage('Please correct errors and hit save again', true);
                        }
                    });
                });
            },
            refresh: function(options) {
                $.setOptions(options);
                var section = d.getElementById('theme-section');
                while (section.firstChild) {
                    var td = section.firstChild;
                    section.removeChild(td);
                    td = null;
                }
                $.action.setButtons(options);
                $.showOptions(options);
            },
            setButtons: function(options) {
                function callback(button) {
                    button.addEventListener('click', function() {
                        var btn = $.layout.setTheme([{
                            magic: 0xCAFEBABE,
                            theme: 'default',
                            start: null,
                            stop: null
                        }]);
                        btn[0].addEventListener('click', function() {
                            this.closest('tr').remove();
                        });
                    });
                }

                var buttons = $.layout.setTheme(options.schedules);
                for (var i = 0; i < buttons.length; i++) {
                    if (i === 0) {
                        callback(buttons[i]);
                    } else {
                        buttons[i].addEventListener('click', function() {
                            this.closest('tr').remove();
                        });
                    }
                }
            },
            isValidJSON: function(defaults, options, file) {
                var isValid = true;
                for (var prop in defaults) {
                    if (defaults.hasOwnProperty(prop)) {
                        if (!(prop in options)) {
                            $.showMessage('SyntaxError: Missing key \'' + prop + '\' in JSON file ' + file.name, true);
                            isValid = false;
                            break;
                        } else {
                            var dp = defaults[prop],
                                op = options[prop];
                            if (Array.isArray(dp) && $.isObject(dp[0]) && Array.isArray(op) && $.isObject(op[0])) {
                                for (var p in dp[0]) {
                                    if (dp[0].hasOwnProperty(p)) {
                                        for (var i = 0; i < op.length; i++) {
                                            if (!(p in op[i])) {
                                                $.showMessage('SyntaxError: Missing key \'' + p + '\' in JSON object \'' + prop + '\' at position ' + i + ' in ' + file.name, true);
                                                isValid = false;
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                return isValid;
            }
        },
        showOptions: function(opt) {
            d.getElementById('enabled').checked = opt.enabled;
            d.getElementById('line-wrap').checked = opt.lineWrap;
            d.getElementById('font-family').value = opt.fontFamily;
            d.getElementById('font-size').value = opt.fontSize;
            d.getElementById('line-height').value = opt.lineHeight;
            d.getElementById('blacklist').value = opt.blacklist.join('\n');
        },
        setOptions: function(options) {
            chrome.storage.sync.set({
                'options': options
            });
        },
        isObject: function(o) {
            return o instanceof Object && o.constructor === Object;
        },
        isNumeric: function(n) {
            return !isNaN(parseFloat(n)) && isFinite(n) && n >= 0;
        },
        validateOptions: function(defaults, opt) {
            var isValid = true,
                alertColor = '#FF0000',
                i;

            if (opt.fontFamily.trim().length < 2) {
                opt.fontFamily = defaults.fontFamily;
                d.getElementById('font-family').style.borderColor = alertColor;
                isValid = false;
            }

            if (!$.isNumeric(opt.fontSize)) {
                opt.fontSize = defaults.fontSize;
                d.getElementById('font-size').style.borderColor = alertColor;
                isValid = false;
            }

            if (!$.isNumeric(opt.lineHeight)) {
                opt.lineHeight = defaults.lineHeight;
                d.getElementById('line-height').style.borderColor = alertColor;
                isValid = false;
            }

            for (i = 0; i < opt.schedules.length; i++) {
                var pattern = /^(\d\d):(\d\d)\s?(AM|PM)?$/i;
                if (!pattern.test(opt.schedules[i].start)) {
                    d.getElementsByClassName('start')[i].style.borderColor = alertColor;
                    isValid = false;
                }
                if (!pattern.test(opt.schedules[i].stop)) {
                    d.getElementsByClassName('stop')[i].style.borderColor = alertColor;
                    isValid = false;
                }
            }

            for (i = 0; i < opt.blacklist.length; i++) {
                try {
                    var regex = new RegExp(opt.blacklist[i]);
                    regex = null;
                } catch (e) {
                    d.getElementById('blacklist').style.borderColor = alertColor;
                    isValid = false;
                    break;
                }
            }

            return {
                options: opt,
                isValid: isValid
            };
        },
        showMessage: function(text, keepAlive, aliveTime) {
            keepAlive = keepAlive || false;
            aliveTime = aliveTime || 3000;

            if (typeof this.timeoutID === 'number') {
                clearTimeout(this.timeoutID);
                this.timeoutID = undefined;
            }

            var alertBox = d.getElementById('alert');
            alertBox.style = 'opacity: 1; transition: opacity 0.4s ease-in;';

            while (alertBox.firstChild) {
                alertBox.removeChild(alertBox.firstChild);
            }

            var div = document.createElement('div');
            div.textContent = text;
            alertBox.appendChild(div);

            var height = div.offsetHeight;
            div.style.height = height + 'px';

            if (!keepAlive) {
                this.timeoutID = setTimeout(function() {
                    alertBox.style = 'opacity: 0; transition: opacity 1s ease-out;';
                    setTimeout(function() {
                        div.style = 'height: 0; overflow: hidden; transition: height 0.25s;';
                        setTimeout(function() {
                            div.remove();
                        }, 1004);
                    }, 1002);
                }, aliveTime);
            }
        },
        showVersion: function() {
            var manifest = chrome.runtime.getManifest();
            return manifest.version;
        },
        layout: {
            o: [
                'default',
                '3024-day',
                '3024-night',
                'abcdef',
                'ambiance-mobile',
                'ambiance',
                'base16-dark',
                'base16-light',
                'bespin',
                'blackboard',
                'cobalt',
                'colorforth',
                'darcula',
                'dracula',
                'duotone-dark',
                'duotone-light',
                'eclipse',
                'elegant',
                'erlang-dark',
                'gruvbox-dark',
                'hopscotch',
                'icecoder',
                'idea',
                'isotope',
                'lesser-dark',
                'liquibyte',
                'lucario',
                'material',
                'mbo',
                'mdn-like',
                'midnight',
                'monokai',
                'neat',
                'neo',
                'night',
                'oceanic-next',
                'panda-syntax',
                'paraiso-dark',
                'paraiso-light',
                'pastel-on-dark',
                'railscasts',
                'rubyblue',
                'seti',
                'shadowfox',
                'solarized',
                'ssms',
                'the-matrix',
                'tomorrow-night-bright',
                'tomorrow-night-eighties',
                'ttcn',
                'twilight',
                'vibrant-ink',
                'xq-dark',
                'xq-light',
                'yeti',
                'zenburn'
            ],
            setTheme: function(data) {
                var fragment = document.createDocumentFragment(),
                    buttons = [];
                for (var i = 0; i < data.length; i++) {
                    var sel = document.createElement('select');
                    sel.className = 'theme-menu';
                    for (var j = 0; j < $.layout.o.length; j++) {
                        var opt = document.createElement('option');
                        opt.text = $.layout.o[j];
                        if ($.layout.o[j] === data[i].theme) {
                            opt.selected = true;
                        }
                        sel.appendChild(opt);
                    }

                    var tr = document.createElement('tr');
                    fragment.appendChild(tr);

                    var c0 = tr.insertCell(0);
                    c0.className = 'cell topic-cell';

                    var c1 = tr.insertCell(1);
                    c1.className = 'cell content-cell menu-cell';
                    c1.appendChild(sel);

                    var c2 = tr.insertCell(2);
                    c2.className = 'cell content-cell';
                    var startInput = document.createElement('input');
                    startInput.className = 'start';
                    startInput.type = 'time';
                    startInput.value = data[i].start ? data[i].start : '';
                    var dash = document.createElement('span');
                    dash.innerHTML = '&nbsp;&ndash;&nbsp;';
                    var stopInput = document.createElement('input');
                    stopInput.className = 'stop';
                    stopInput.type = 'time';
                    stopInput.value = data[i].stop ? data[i].stop : '';
                    c2.appendChild(startInput);
                    c2.appendChild(dash);
                    c2.appendChild(stopInput);

                    var c3 = tr.insertCell(3);
                    c3.className = 'cell content-cell';

                    var button = document.createElement('button');
                    button.className = 'action-button';
                    if (data.length !== 1) {
                        if (i === 0 && !this.added) {
                            button.textContent = '+';
                            c0.textContent = 'Theme schedules';
                        } else {
                            button.textContent = '-';
                            this.added = true;
                        }
                    } else {
                        if ('magic' in data[0]) {
                            button.textContent = '-';
                        } else {
                            button.textContent = '+';
                            c0.textContent = 'Theme schedules';
                        }
                    }
                    c3.appendChild(button);

                    buttons.push(button);
                }
                var section = d.getElementById('theme-section');
                section.appendChild(fragment);
                return buttons;
            },
            getNativeStyle: function() {
                this.border = {};
                this.border.fontFamily = d.getElementById('font-family').style.borderColor;
                this.border.fontSize = d.getElementById('font-size').style.borderColor;
                this.border.lineHeight = d.getElementById('line-height').style.borderColor;
                this.border.blacklist = d.getElementById('blacklist').style.borderColor;
                this.border.startTime = d.getElementsByClassName('start')[0].style.borderColor;
                this.border.stopTime = d.getElementsByClassName('stop')[0].style.borderColor;
            },
            setNativeStyle: function() {
                d.getElementById('font-family').style.borderColor = this.border.fontFamily;
                d.getElementById('font-size').style.borderColor = this.border.fontSize;
                d.getElementById('line-height').style.borderColor = this.border.lineHeight;
                d.getElementById('blacklist').style.borderColor = this.border.blacklist;
                var start = d.getElementsByClassName('start'),
                    stop = d.getElementsByClassName('stop');
                for (var i = 0; i < start.length; i++) {
                    start[i].style.borderColor = this.border.startTime;
                    stop[i].style.borderColor = this.border.stopTime;
                }
            }
        }
    };

    $.init();
})(document);
