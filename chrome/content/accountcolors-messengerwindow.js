/************************************************************************/
/*                                                                      */
/*      Account Colors  -  Thunderbird Extension  -  3Pane Window       */
/*                                                                      */
/*      Javascript for 3Pane Window overlay                             */
/*                                                                      */
/*      Copyright (C) 2008-2020  by  DW-dev                             */
/*      Copyright (C) 2022-2022  by  MrMelon54                          */
/*                                                                      */
/*      Last Edit  -  15 Jul 2022                                       */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/*  Changes in Thunderbird 68.0                                         */
/*                                                                      */
/*  Overview of changes:                                                */
/*                                                                      */
/*    - https://developer.thunderbird.net/add-ons/tb68/changes          */
/*                                                                      */
/*  Reference for removed nsITreeBoxObject interface:                   */
/*                                                                      */
/*    - https://developer.mozilla.org/en-US/docs/Mozilla/Tech/          */
/*              XPCOM/Reference/Interface/nsITreeBoxObject              */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/*  Color Received Messages by Identity instead of Account:             */
/*                                                                      */
/*  Could easily change getAccountKey() to getIdentityKey() and then    */
/*  color font and background in thread pane and message pane using     */
/*  identity instead of account.  In essence, getIdentityKey() would    */
/*  ignore msgHdr.accountKey and just search for matching identity.     */
/*                                                                      */
/************************************************************************/

"use strict";

var accountColorsMessenger = {
  prefs: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.accountcolors."),

  mailPrefs: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("mail."),

  otherPrefs: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch),

  accountManager: Components.classes["@mozilla.org/messenger/account-manager;1"].getService(Components.interfaces.nsIMsgAccountManager),

  winmed: Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator),

  /* Listen for changes to mail settings - to detect add/remove account */

  mailPrefsObserver: {
    register: function () {
      /* Add the observer */
      this.registered = true;
      accountColorsMessenger.mailPrefs.addObserver("", this, false);
    },

    unregister: function () {
      if (!this.registered) return;

      accountColorsMessenger.mailPrefs.removeObserver("", this);
    },

    observe: function (subject, topic, data) {
      if (topic != "nsPref:changed") return;

      /* Validate coloring preferences */

      accountColorsMessenger.validatePrefs();
    },
  },

  /* On Unload */

  onUnload: function () {
    accountColorsMessenger.mailPrefsObserver.unregister();

    if (accountColorsUtilities.thunderbirdVersion.major <= 102) {
      accountColorsAbout3Pane.onUnload();
    }
  },

  /* On Load */

  onLoad: function () {
    /* Validate coloring preferences */

    accountColorsMessenger.validatePrefs();

    /* Register mail preferences observers */

    accountColorsMessenger.mailPrefsObserver.register();

    if (accountColorsUtilities.thunderbirdVersion.major <= 102) {
      accountColorsAbout3Pane.onLoad();
    }
  },

  /* Validate account/identity font and background coloring preferences */

  validatePrefs: function () {
    var index, acc, account, id, identity, accountkey, identitykey;
    var accounts = new Array();
    var identities = new Array();
    var accountsprefs = new Array();
    var identitiesprefs = new Array();

    /* Add coloring preferences for added account */

    index = 0;

    accounts = accountColorsMessenger.accountManager.accounts;

    for (acc = 0; acc < accountColorsUtilities.getLength(accounts); acc++) {
      account = accountColorsUtilities.getAccount(accounts, acc);

      identities = account.identities;

      if (accountColorsUtilities.getLength(identities) == 0) {
        /* Local Folders account or Blogs & Newsfeeds account */
        if (!accountColorsMessenger.prefs.prefHasUserValue(account.key + "-fontcolor") || !accountColorsMessenger.prefs.prefHasUserValue(account.key + "-bkgdcolor")) {
          accountColorsMessenger.prefs.setCharPref(account.key + "-fontcolor", "");
          accountColorsMessenger.prefs.setCharPref(account.key + "-bkgdcolor", "");
        }

        index++;
      } else {
        for (id = 0; id < accountColorsUtilities.getLength(identities); id++) {
          identity = accountColorsUtilities.getIdentity(identities, id);

          if (!accountColorsMessenger.prefs.prefHasUserValue(identity.key + "-fontcolor") || !accountColorsMessenger.prefs.prefHasUserValue(identity.key + "-bkgdcolor")) {
            accountColorsMessenger.prefs.setCharPref(identity.key + "-fontcolor", "");
            accountColorsMessenger.prefs.setCharPref(identity.key + "-bkgdcolor", "");
          }

          index++;
        }
      }
    }

    /* Remove coloring preferences for removed account */

    accountsprefs = accountColorsMessenger.prefs.getChildList("account", {});

    for (acc = 0; acc < accountsprefs.length; acc++) {
      accountkey = accountsprefs[acc].substr(0, accountsprefs[acc].indexOf("-"));

      if (!accountColorsMessenger.mailPrefs.prefHasUserValue("account." + accountkey + ".server") || accountColorsMessenger.mailPrefs.prefHasUserValue("account." + accountkey + ".identities")) {
        accountColorsMessenger.prefs.clearUserPref(accountkey + "-fontcolor");
        accountColorsMessenger.prefs.clearUserPref(accountkey + "-bkgdcolor");
      }
    }

    identitiesprefs = accountColorsMessenger.prefs.getChildList("id", {});

    for (id = 0; id < identitiesprefs.length; id++) {
      identitykey = identitiesprefs[id].substr(0, identitiesprefs[id].indexOf("-"));

      if (!accountColorsMessenger.mailPrefs.prefHasUserValue("identity." + identitykey + ".useremail")) {
        accountColorsMessenger.prefs.clearUserPref(identitykey + "-fontcolor");
        accountColorsMessenger.prefs.clearUserPref(identitykey + "-bkgdcolor");
      }
    }
  },

  cmdOptions: function () {
    var optionsWindow;

    optionsWindow = accountColorsMessenger.winmed.getMostRecentWindow("accountcolors-options");

    if (optionsWindow) optionsWindow.focus();
    else window.openDialog("chrome://accountcolors/content/accountcolors-options.xhtml", "", "chrome,dialog,titlebar,centerscreen", null);
  },
};
