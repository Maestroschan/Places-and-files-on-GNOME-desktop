const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const ShellEntry = imports.ui.shellEntry;
const Util = imports.misc.util;
const Signals = imports.signals;

const Gettext = imports.gettext.domain('places-files-desktop');
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Extension = Me.imports.extension;

//-------------------------------------------------

var HeaderBox = new Lang.Class({
	Name: 'HeaderBox',
	Extends: St.BoxLayout,
	
	_init: function(layout) {
		this.layout = layout;
		this.actor = this;
		this.parent({
			vertical: false,
			style_class: 'convenient-list-header',
		});
		
		this.searchEntry = new St.Entry({
			name: 'searchEntry',
			style_class: 'search-entry',
			can_focus: true,
			hint_text: _('Type here to search...'),
			track_hover: true,
			y_expand: false,
			primary_icon: new St.Icon({
				icon_name: 'edit-find-symbolic',
				icon_size: 16,
				style_class: 'system-status-icon',
				y_align: Clutter.ActorAlign.CENTER,
			}),
			secondary_icon: new St.Icon({
				icon_name: 'edit-clear-symbolic',
				icon_size: 16,
				style_class: 'system-status-icon',
				y_align: Clutter.ActorAlign.CENTER,
			}),
		});
		this.searchEntry.get_clutter_text().connect('text-changed',
		                                  this._onSearchTextChanged.bind(this));
		this.searchEntry.connect('secondary-icon-clicked',
		                                        this._onIconRelease.bind(this));
//		this.searchEntry.connect('enter-event', this.beginSearch.bind(this));
		this.searchEntry.connect('key-focus-in', this.beginSearch.bind(this)); // ???? XXX TODO
		this.searchEntry.connect('key-focus-out', this.endSearch.bind(this));
		ShellEntry.addContextMenu(this.searchEntry, null);
		
		//--------------------------------
	
		this.filterButton = new St.Button({
			child: new St.Icon({
				icon_name: 'view-more-symbolic',
				style_class: 'system-status-icon',
				icon_size: 16,
				y_align: Clutter.ActorAlign.CENTER,
			}),
			accessible_name: _("Search filters"),
			y_align: Clutter.ActorAlign.CENTER,
			style_class: 'button',
			style: 'padding-right: 12px; padding-left: 12px;',
			reactive: true,
			can_focus: true,
			track_hover: true,
			y_expand: false,
			y_fill: true,
		});
		
		this.filterMenu = new FilterMenuButton(this.filterButton);

		//--------------------------------
	
		this.settingsButton = new St.Button({
			child: new St.Icon({
				icon_name: 'emblem-system-symbolic',
				style_class: 'system-status-icon',
				icon_size: 16,
				y_align: Clutter.ActorAlign.CENTER,
			}),
			accessible_name: _("Settings"),
			y_align: Clutter.ActorAlign.CENTER,
			style_class: 'button',
			style: 'padding-right: 12px; padding-left: 12px;',
			reactive: true,
			can_focus: true,
			track_hover: true,
			y_expand: false,
			y_fill: true
		});
		
		this.settingsButton.connect('clicked', this.openSettings.bind(this));

		//--------------------------------
		
		this.add(new St.BoxLayout({x_expand: true,}));
		this.add(this.searchEntry);
		this.add(this.filterButton);
		this.add(this.settingsButton);
		this.add(new St.BoxLayout({x_expand: true,}));
	},
	
	beginSearch: function() {
//		this.searchEntry.set_text('');
		global.stage.set_key_focus(this.searchEntry);
	},
	
	endSearch: function() {
		return;
	},
	
	openSettings: function() {
		Util.spawn(["gnome-shell-extension-prefs", "places-and-files-on-desktop@maestroschan.fr"]);
	},
	
	_onIconRelease: function() {
		this.searchEntry.set_text('');
	},
	
	_onSearchTextChanged: function() {
		this.layout.filter_widgets(this.searchEntry.get_text().toLowerCase());
	},
	
	filter_widget: function(text) {
		/* nothing */
	},
});

//------------------------

var FilterMenuButton = new Lang.Class({
	Name: 'FilterMenuButton',

	_init: function(bouton){
		this.actor = bouton;
		this.actor.connect('button-press-event', this._onButtonPress.bind(this));
		this._menu = null;
		this._menuManager = new PopupMenu.PopupMenuManager(this);
	},

	_onMenuPoppedDown: function() {
		this.actor.sync_hover();
		this.emit('menu-state-changed', false);
	},

	popupMenu: function() {
		this.actor.fake_release();
		if (!this._menu) {
			this._menu = new FilterMenu(this);
			this._menu.connect('open-state-changed', Lang.bind(this, function (menu, isPoppedUp) {
				if (!isPoppedUp)
					this._onMenuPoppedDown();
			}));
			this._menuManager.addMenu(this._menu);
		}
		this.emit('menu-state-changed', true);
		this.actor.set_hover(true);
		this._menu.popup();
		this._menuManager.ignoreRelease();
		return false;
	},

	_onButtonPress: function(actor, event) {
		this.popupMenu();
		return Clutter.EVENT_STOP;
	},
});
Signals.addSignalMethods(FilterMenuButton.prototype);

//------------------------------------------------

const FilterMenu = new Lang.Class({
	Name: 'FilterMenu',
	Extends: PopupMenu.PopupMenu,

	_init: function(source) {
		this.parent(source.actor, 0.5, St.Side.RIGHT);
		this._source = source;
		this.actor.add_style_class_name('app-well-menu');
		this._source.actor.connect('destroy', this.destroy.bind(this));

		// We want to keep the item hovered while the menu is up
		this.blockSourceEvents = true;

		Main.uiGroup.add_actor(this.actor);
	},

	_redisplay: function() {
		this.removeAll();
		
		let inPathSetting = Extension.SETTINGS.get_boolean('search-in-path');
		let blackListSetting = Extension.SETTINGS.get_strv('blacklist-recent');
		let blackListIsEmpty = (blackListSetting == '');
		
		this.inPathItem = new PopupMenu.PopupSwitchMenuItem(_("Search in files' path"), inPathSetting);
		this.inPathItem.connect('toggled', Lang.bind(this, function (a, b, c) {
			Extension.SETTINGS.set_boolean('search-in-path', b);
		}));
		
		this.allFilesItem = new PopupMenu.PopupSwitchMenuItem(_("All files"), blackListIsEmpty);
		this.allFilesItem.connect('toggled', Lang.bind(this, function (a, b, c) {
			Extension.SETTINGS.set_strv('blacklist-recent', []);
		}));
		
		this.addMenuItem(this.inPathItem);
		this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		this.addMenuItem(this.allFilesItem);

		let filesTypes = ['text', 'image', 'audio', 'video', 'application',
			'multipart', 'message', 'model'];
		let filesTypesLabels = [_("Text files"), _("Image files"), _("Audio files"),
			_("Video files"), _("Application files"), _("Multipart files"),
			_("Message files"), _("Model files")];

		for (var i = 0; i < filesTypes.length; i++) {
			let labelItem = filesTypesLabels[i] ;
			let item = new PopupMenu.PopupMenuItem( labelItem );
			item.connect('activate', Lang.bind(this, function(a, b, c) {
				let blr = Extension.SETTINGS.get_strv('blacklist-recent');
				if (blr.includes(c)) {
					let index = blr.indexOf(c);
					blr.splice(index, 1);
					a.setOrnament(2);
				} else {
					blr.push(c);
					a.setOrnament(0);
				}
				Extension.SETTINGS.set_strv('blacklist-recent', blr);
			}, filesTypes[i]));
			if (blackListSetting.includes(filesTypes[i])) {
				item.setOrnament(0);
			} else {
				item.setOrnament(2);
			}
 			this.addMenuItem(item);
		}
	},

	popup: function(activatingButton) {
		this._redisplay();
		this.open();
	},
});
Signals.addSignalMethods(FilterMenu.prototype);

