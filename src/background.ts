const BG_VERSION = 18
const NEED_DROPPER_VERSION = 13
const DEFAULT_COLOR = '#b48484'

interface BgSettings {
    enableColorToolbox: boolean
    enableColorTooltip: boolean
    enableRightClickDeactivate: boolean
    dropperCursor: string
}

var bg = {
    tab: null as chrome.tabs.Tab,
    tabs: [] as Array<chrome.tabs.Tab>,
    version: BG_VERSION,
    screenshotData: '',
    screenshotFormat: 'png',
    canvas: document.createElement('canvas'),
    canvasContext: null,
    debugImage: null,
    debugTab: 0,
    defaultSettings: {
        enableColorToolbox: true,
        enableColorTooltip: true,
        enableRightClickDeactivate: true,
        dropperCursor: 'default',
    },
    settings: {} as BgSettings,
    edCb: null,
    color_sources: {
        1: 'Web Page',
        2: 'Color Picker',
    },
    // use selected tab
    // need to null all tab-specific variables
    useTab: function (tab: chrome.tabs.Tab) {
        bg.tab = tab
        bg.screenshotData = ''
        bg.canvas = document.createElement('canvas')
        bg.canvasContext = null
    },
    checkDropperScripts: function () {
        console.log('bg: checking dropper version')
        bg.sendMessage(
            {
                type: 'edropper-version',
            },
            function (res: { version: number; tabid: number }) {
                console.log('bg: checking dropper version 2')
                if (chrome.runtime.lastError || !res) {
                    bg.injectDropper()
                } else {
                    if (res.version < NEED_DROPPER_VERSION) {
                        bg.refreshDropper()
                    } else {
                        bg.pickupActivate()
                    }
                }
            },
        )
    },
    injectDropper: function () {
        console.log('bg: injecting dropper scripts')
        chrome.tabs.executeScript(
            bg.tab.id,
            {
                file: '/js/edropper2.js',
            },
            function (_results: Array<any>) {
                console.log('bg: edropper2 injected')
                bg.pickupActivate()
            },
        )
    },
    refreshDropper: function () {
        console.log('bg: refreshing dropper scripts')
        chrome.tabs.executeScript(
            bg.tab.id,
            {
                allFrames: true,
                file: '/js/edropper2.js',
            },
            function (_results: Array<any>) {
                console.log('bg: edropper2 updated')
                bg.pickupActivate()
            },
        )
    },
    sendMessage: function (message: any, callback?: (response: any) => void) {
        chrome.tabs.sendMessage(bg.tab.id, message, callback)
    },
    shortcutListener: function () {
        chrome.commands.onCommand.addListener((command) => {
            console.log('bg: command: ', command)
            switch (command) {
                case 'activate':
                    bg.activate2()
                    break
            }
        })
    },
    messageListener: function () {
        // simple messages
        chrome.runtime.onMessage.addListener((req, _sender, sendResponse) => {
            switch (req.type) {
                case 'activate-from-hotkey':
                    bg.activate2()
                    sendResponse({})
                    break
                // Reload background script
                case 'reload-background':
                    window.location.reload()
                    break
            }
        })
        // longer connections
        chrome.runtime.onConnect.addListener((port) => {
            port.onMessage.addListener((req, sender) => {
                switch (req.type) {
                    // Taking screenshot for content script
                    case 'screenshot':
                        ////console.log('received screenshot request')
                        bg.capture()
                        break
                    // Creating debug tab
                    case 'debug-tab':
                        console.info('Received debug tab request')
                        bg.debugImage = req.image
                        bg.createDebugTab()
                        break
                    // Set color given in req
                    // FIXME: asi lepší z inject scriptu posílat jen rgbhex, už to tak máme stejně skoro všude
                    case 'set-color':
                        console.log(sender.sender)
                        console.log(req.color)
                        break
                }
            })
        })

        /**
         * When Eye Dropper is just installed, we want to display nice
         * page to user with some instructions
         */
    },
    setBadgeColor: function (color: string) {
        console.info('Setting badge color to ' + color)
        chrome.browserAction.setBadgeBackgroundColor({
            color: [
                parseInt(color.substr(1, 2), 16),
                parseInt(color.substr(3, 2), 16),
                parseInt(color.substr(5, 2), 16),
                255,
            ],
        })
    },
    activate2: function () {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs: Array<chrome.tabs.Tab>) => {
            bg.useTab(tabs[0])
            bg.activate()
        })
    },
    // activate Pick
    activate: function () {
        console.log('bg: received pickup activate')
        // check scripts and activate pickup
        bg.checkDropperScripts()
    },
    pickupActivate: function () {
        // activate picker
        bg.sendMessage({
            type: 'pickup-activate',
            options: {
                cursor: bg.settings.dropperCursor,
                enableColorToolbox: bg.settings.enableColorToolbox,
                enableColorTooltip: bg.settings.enableColorTooltip,
                enableRightClickDeactivate: bg.settings.enableRightClickDeactivate,
            },
        })
        console.log('bg: activating pickup')
    },
    // capture actual Screenshot
    capture: function () {
        ////console.log('capturing')
        try {
            chrome.tabs.captureVisibleTab(
                null,
                {
                    format: 'png',
                },
                bg.doCapture,
            )
            // fallback for chrome before 5.0.372.0
        } catch (e) {
            chrome.tabs.captureVisibleTab(null, bg.doCapture)
        }
    },
    doCapture: function (data: string) {
        if (data) {
            console.log('bg: sending updated image')
            bg.sendMessage({
                type: 'update-image',
                data: data,
            })
        } else {
            console.error('bg: did not receive data from captureVisibleTab')
        }
    },
    createDebugTab: function () {
        // DEBUG PAGE
        if (bg.debugTab != 0) {
            chrome.tabs.sendMessage(bg.debugTab, {
                type: 'update',
            })
        } else
            chrome.tabs.create(
                {
                    url: '/debug-tab.html',
                    selected: false,
                },
                function (tab) {
                    bg.debugTab = tab.id
                },
            )
    },
    tabOnChangeListener: function () {
        // deactivate dropper if tab changed
        chrome.tabs.onSelectionChanged.addListener((tabId, _selectInfo) => {
            if (bg.tab && bg.tab.id == tabId)
                bg.sendMessage({
                    type: 'pickup-deactivate',
                })
        })
    },
    /**
     * Load settings from storage on extension start
     */
    loadSettings: function () {
        console.info('Loading settings from storage')
        chrome.storage.sync.get('settings', function (items) {
            if (items.settings) {
                console.info('Settings loaded')
                bg.settings = items.settings
            } else {
                console.log('No settings in storage')
                bg.tryConvertOldSettings()
            }
        })
    },
    /**
     * sources:
     *    1: eye dropper
     *    2: color picker
     *
     * FIXME:
     * url is not saved now because of quotas
     * favorite not implemented yet
     *
     * h = hex
     * n = name
     * s = source
     * t = timestamp when taken
     * f = favorite
     */
    /**
     * Convert pre 0.4 Eye Dropper local settings to synced storage
     *
     * Synced storage is much better because it finally allows as to store objects and not
     * strings only.
     *
     */
    tryConvertOldSettings: function () {
        // load default settings first
        bg.settings = bg.defaultSettings
        // convert old settings
        bg.settings.enableColorToolbox =
            window.localStorage.enableColorToolbox === 'false' ? false : true
        bg.settings.enableColorTooltip =
            window.localStorage.enableColorTooltip === 'false' ? false : true
        bg.settings.enableRightClickDeactivate =
            window.localStorage.enableRightClickDeactivate === 'false' ? false : true
        bg.settings.dropperCursor =
            window.localStorage.dropperCursor === 'crosshair' ? 'crosshair' : 'default'
        // sync settings
        bg.saveSettings()
        // remove old settings from local storage
        var setting_keys = [
            'enableColorTooltip',
            'enableColorToolbox',
            'enableRightClickDeactivate',
            'dropperCursor',
        ]
        for (var _i = 0, setting_keys_1 = setting_keys; _i < setting_keys_1.length; _i++) {
            var setting_name = setting_keys_1[_i]
            localStorage.removeItem(setting_name)
        }
        console.info('Removed old settings from locale storage.')
    },
    saveSettings: function () {
        chrome.storage.sync.set(
            {
                settings: bg.settings,
            },
            function () {
                console.info('Settings synced to storage')
            },
        )
    },
    init: function () {
        console.group('init')
        bg.loadSettings()
        //      
        // set default badge text to empty string
        // we are comunicating with users only through badge background color
        chrome.browserAction.setBadgeText({
            text: ' ',
        })
        // we have to listen for messages
        bg.messageListener()
        // act when tab is changed
        // TODO: call only when needed? this is now used also if picker isn't active
        bg.tabOnChangeListener()
        // listen for shortcut commands
        bg.shortcutListener()
        console.groupEnd()
    },
}

document.addEventListener('DOMContentLoaded', function () {
    bg.init()
})
    ; (<any>window).bg = bg
