// ==UserScript==
// @name		RaChart™ Enhancer
// @author		Sighery
// @description	Enhances Rachel's charts in SG by highlighting you the games you own already
// @version		0.30.4
// @downloadURL	https://github.com/Sighery/RaChart/raw/master/RaChart%20Enhancer/RaChartEnhancer.user.js
// @updateURL	https://github.com/Sighery/RaChart/raw/master/RaChart%20Enhancer/RaChartEnhancer.meta.js
// @supportURL	https://www.steamgifts.com/discussion/riOvr/
// @namespace	Sighery
// @match		https://www.steamgifts.com/*
// @grant		GM_xmlhttpRequest
// @grant		GM_notification
// @grant		GM_setValue
// @grant		GM_getValue
// @grant		GM_deleteValue
// @connect		api.steampowered.com
// @connect		store.steampowered.com
// @require		https://www.kryogenix.org/code/browser/sorttable/sorttable.js
// @require		https://gist.githubusercontent.com/Sighery/feddf87a45215ead08ae8c3321a2083d/raw/52294fe11c35bfb20dcfee06a9972e001cbdad31/python-string-format.js
// @require		https://gist.githubusercontent.com/Sighery/d1ea3de4da5ff7e8b36c6ec0ea74a1c2/raw/080107877f9b2ddaebaacc629ce6ee7d6bedb1de/draggable-absolute-dialog.js
// ==/UserScript==


// ==================== CONSTANTS ====================
// For easier remembering
// Types for highlight function
const HIGHLIGHT_OWNED = 0;
const HIGHLIGHT_PARTIALLY_OWNED = 1;
const HIGHLIGHT_WISHLIST = 2;
const HIGHLIGHT_IGNORED = 3;
// Default colors for highlighting rows
const OWNED_DEFAULT = "#C2FFAD";
const OWNED_MBLUE = "#0E4E0E";
const OWNED_MDARK = "#0E4E0E";
const OWNED_SPDARK = "#0E4E0E";
const PARTIALLY_OWNED_DEFAULT = "#FFD68F";
const PARTIALLY_OWNED_MBLUE = "rgba(150, 90, 16, 0.7)";
const PARTIALLY_OWNED_MDARK = "rgba(150, 90, 16, 0.7)";
const PARTIALLY_OWNED_SPDARK = "rgba(255, 112, 67, 0.60)";
const WISHLIST_DEFAULT = "#5DFBF3";
const WISHLIST_MBLUE = "rgba(120, 154, 201, 0.70)";
const WISHLIST_MDARK = "rgba(120, 154, 201, 0.70)";
const WISHLIST_SPDARK = "#408884";
const IGNORED_DEFAULT = "#9E9E9E";
const IGNORED_MBLUE = "rgba(93, 86, 84, 0.9)";
const IGNORED_MDARK = "rgba(93, 86, 84, 0.9)";
const IGNORED_SPDARK = "rgba(93, 86, 84, 0.9)";



// ==================== MAIN ====================
refractorStorage();
injectInterface();

if ((window.location.href.match(".steamgifts.com/discussion/") || window.location.href.match(".steamgifts.com/giveaway/")) !== null && confirmAuthor()) {
	var apiKey = localStorage.getItem('APIKey');
	var steamID64 = localStorage.getItem('SteamID64');
	var bStoreMethod = localStorage.getItem('RCE-StoreMethod');

	var apps = scanTable();
	var appIDs = apps[0];
	var subIDs = apps[1];

	// Add the CSS for being able to highlight rows
	injectHighlightStyle();

	if ((appIDs.length || subIDs.length) > 0) {
		if (bStoreMethod !== null && bStoreMethod !== undefined) {
			storeMethodRequest(appIDs, subIDs);
		} else if (checkIDAPI()) {
			if (appIDs.length > 0) {
				webApiOwnedRequest(appIDs);
			}

			if (subIDs.length > 0) {
				for (var i = 0; i < subIDs.length; i++) {
					storefrontApiAppsInPack(subIDs[i]);
				}
			}
		}
	}
}



// ==================== FUNCTIONALITY ====================
// ========== REQUESTS FUNCTIONS ==========
function storeMethodRequest(appIDs, subIDs) {
	appIDs = turnToIntArray(appIDs);
	subIDs = turnToIntArray(subIDs);

	GM_xmlhttpRequest({
		method: "GET",
		url: "https://store.steampowered.com/dynamicstore/userdata/",
		timeout: 5000,
		headers: {
			"Cache-Control": "no-cache, no-store, must-revalidate"
		},
		onload: function(response) {
			var jsonFile = JSON.parse(response.responseText);
			var i;

			if (checkLoginStoreMethod(jsonFile) === false) {
				if (checkIDAPI() === false) {
					GM_notification({
						title: "RaChart™ Enhancer",
						text: "Error: Not logged into the Steam store and not enough info to use the API.",
						image: "http://i.imgur.com/f2OtaSe.png",
						highlight: false,
						timeout: 3
					});
				} else {
					GM_notification({
						title: "RaChart™ Enhancer",
						text: "Error: Not logged into the Steam store.",
						image: "http://i.imgur.com/f2OtaSe.png",
						highlight: false,
						timeout: 1.5
					});

					if (appIDs.length > 0) {
						webApiOwnedRequest(appIDs);
					}

					if (subIDs.length > 0) {
						for (i = 0; i < subIDs.length; i++) {
							storefrontApiAppsInPack(subIDs[i]);
						}
					}
				}
			} else {
				if (appIDs.length > 0) {
					var notOwnedApps = orderedMatchingAlgorithm(appIDs, jsonFile.rgOwnedApps, function(appID) {
						highlight('app/{0}'.format(appID), HIGHLIGHT_OWNED);
					});

					if (notOwnedApps.length > 0) {
						var notWishlistApps = orderedMatchingAlgorithm(notOwnedApps, jsonFile.rgWishlist, function(appID) {
							highlight('app/{0}'.format(appID), HIGHLIGHT_WISHLIST);
						});

						if (notWishlistApps.length > 0) {
							// Due to a recent change, Steam now sends rgIgnoredApps
							// as an array of objects such as {284750: 0}
							var ignoredApps = turnToIntArray(Object.keys(jsonFile.rgIgnoredApps));

							orderedMatchingAlgorithm(notWishlistApps, ignoredApps, function(appID) {
								highlight('app/{0}'.format(appID), HIGHLIGHT_IGNORED);
							});
						}
					}
				}

				if (subIDs.length > 0) {
					var notOwnedPacks = orderedMatchingAlgorithm(subIDs, jsonFile.rgOwnedPackages, function(subID) {
						highlight('sub/{0}'.format(subID), HIGHLIGHT_OWNED);
					});

					if (notOwnedPacks.length > 0) {
						for (i = 0; i < notOwnedPacks.length; i++) {
							storefrontApiAppsInPack(notOwnedPacks[i], function(response) {
								var subID = response.subID;
								var jsonPackFile = JSON.parse(response.responseText);
								var arrayApps = [];


								if (jsonPackFile[subID].success === false) {
									console.warn('Invalid subID entry {0}'.format(subID));

									var invalids = document.querySelectorAll("a[href*='sub/{0}']".format(subID));

									invalids.forEach(function(element) {
										element.style.backgroundColor = "red";
										element.title += " Invalid link";

										// Maybe remove id from classList?
										// element.classList.remove(id);
									});
								} else {
									for (var i = 0; i < jsonPackFile[subID].data.apps.length; i++) {
										arrayApps.push(jsonPackFile[subID].data.apps[i].id);
									}

									var notMatchedApps = orderedMatchingAlgorithm(arrayApps, jsonFile.rgOwnedApps);

									if (notMatchedApps.length === 0) {
										highlight('sub/{0}'.format(subID), HIGHLIGHT_OWNED);
									} else if (notMatchedApps.length !== arrayApps.length) {
										highlight('sub/{0}'.format(subID), HIGHLIGHT_PARTIALLY_OWNED);
									} else {
										orderedMatchingAlgorithm([subID], jsonFile.rgIgnoredPackages, function(subID) {
											highlight('sub/{0}'.format(subID), HIGHLIGHT_IGNORED);
										});
									}
								}
							});
						}
					}
				}
			}
		},
		ontimeout: function(response) {
			if (checkIDAPI() === false) {
					GM_notification({
						title: "RaChart™ Enhancer",
						text: "Error: Not logged into the Steam store and not enough info to use the API.",
						image: "http://i.imgur.com/f2OtaSe.png",
						highlight: false,
						timeout: 3
					});
			} else {
				GM_notification({
					title: "RaChart™ Enhancer",
					text: "Error: Store request timed out.",
					image: "http://i.imgur.com/f2OtaSe.png",
					highlight: false,
					timeout: 1.5
				});

				if (appIDs.length > 0) {
					webApiOwnedRequest(appIDs);
				}

				if (subIDs.length > 0) {
					for (i = 0; i < subIDs.length; i++) {
						storefrontApiAppsInPack(subIDs[i]);
					}
				}
			}
		},
		onerror: function(response) {
			if (checkIDAPI() === false) {
					GM_notification({
						title: "RaChart™ Enhancer",
						text: "Error: Not logged into the Steam store and not enough info to use the API.",
						image: "http://i.imgur.com/f2OtaSe.png",
						highlight: false,
						timeout: 3
					});
			} else {
				GM_notification({
					title: "RaChart™ Enhancer",
					text: "Error: Unable to make the request to the store.",
					image: "http://i.imgur.com/f2OtaSe.png",
					highlight: false,
					timeout: 1.5
				});

				if (appIDs.length > 0) {
					webApiOwnedRequest(appIDs);
				}

				if (subIDs.length > 0) {
					for (i = 0; i < subIDs.length; i++) {
						storefrontApiAppsInPack(subIDs[i]);
					}
				}
			}
		}
	});
}


function webApiOwnedRequest(appidsFilter, customFunction = null) {
	appidsFilter = turnToIntArray(appidsFilter);
	// var link = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=" + apiKey + "&input_json={\"steamid\":" + steamID64 + ",\"appids_filter\":" + JSON.stringify(appidsFilter) + "}";
	var link = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key={0}&input_json={\"steamid\":{1},\"appids_filter\":{2}}".format(apiKey, steamID64, JSON.stringify(appidsFilter));

	GM_xmlhttpRequest({
		method: "GET",
		url: link,
		timeout: 5000,
		onload: function(response) {
			if (customFunction === null) {
				var jsonFile = JSON.parse(response.responseText);

				if (jsonFile.response.game_count > 0) {
					for (var i = 0; i < jsonFile.response.games.length; i++) {
						highlight("app/{0}".format(jsonFile.response.games[i].appid), HIGHLIGHT_OWNED);
					}
				}
			} else {
				customFunction(response);
			}
		},
		ontimeout: function(response) {
			GM_notification({
				title: "RaChart™ Enhancer",
				text: "Error: Request for fetching owned apps timed out.",
				image: "http://i.imgur.com/f2OtaSe.png",
				highlight: false,
				timeout: 3
			});
		},
		onerror: function(response) {
			GM_notification({
				title: "RaChart™ Enhancer",
				text: "Error: Could not fetch owned games.",
				image: "http://i.imgur.com/f2OtaSe.png",
				highlight: false,
				timeout: 3
			});
		}
	});
}


function storefrontApiAppsInPack(subID, customFunction = null) {
	GM_xmlhttpRequest({
		method: "GET",
		url: "https://store.steampowered.com/api/packagedetails/?packageids=" + subID,
		timeout: 3000,
		onload: function(response) {
			if (customFunction === null) {
				var jsonFile = JSON.parse(response.responseText);
				var arrayApps = [];

				for (var i = 0; i < jsonFile[subID].data.apps.length; i++) {
					arrayApps.push(jsonFile[subID].data.apps[i].id);
				}

				arrayApps = turnToIntArray(arrayApps);

				webApiOwnedRequest(arrayApps, function(response) {
					var jsonFile = JSON.parse(response.responseText);

					if (jsonFile.response.game_count === arrayApps.length) {
						highlight('sub/{0}'.format(subID), HIGHLIGHT_OWNED);
					} else if (jsonFile.response.game_count !== 0) {
						highlight('sub/{0}'.format(subID), HIGHLIGHT_PARTIALLY_OWNED);
					}
				});

			} else {
				response.subID = subID;
				customFunction(response);
			}
		},
		ontimeout: function(response) {
			GM_notification({
				title: "RaChart™ Enhancer",
				text: "Error: Request for fetching apps in package " + subID + " timed out.",
				image: "http://i.imgur.com/f2OtaSe.png",
				highlight: false,
				timeout: 3
			});
		},
		onerror: function(response) {
			GM_notification({
				title: "RaChart™ Enhancer",
				text: "Error: Could not fetch apps in package " + subID + ".",
				image: "http://i.imgur.com/f2OtaSe.png",
				highlight: false,
				timeout: 3
			});
		}
	});
}


// ========== CHECKING FUNCTIONS ==========
function checkIDAPI(notifications = true) {
	var bdismissed = GM_getValue("DismissedMissing", false);
	if (bdismissed) {
		return false;
	}

	var bAPIKey = localStorage.getItem("APIKey");
	var bSteamID64 = localStorage.getItem("SteamID64");

	if (bAPIKey === null && bSteamID64 === null) {
		if (notifications) {
			GM_notification({
				title: "RaChart™ Enhancer",
				text: "Missing API key and Steam ID64. Click to dismiss and not show again.",
				image: "http://i.imgur.com/f2OtaSe.png",
				highlight: false,
				timeout: 3,
				onclick: function() {
					GM_setValue("DismissedMissing", true);
				}
			});
		}

		return false;
	} else if (bAPIKey === null) {
		if (notifications) {
			GM_notification({
				title: "RaChart™ Enhancer",
				text: "Missing API key. Click to dismiss and not show again.",
				image: "http://i.imgur.com/f2OtaSe.png",
				highlight: false,
				timeout: 3,
				onclick: function() {
					GM_setValue("DismissedMissing", true);
				}
			});
		}

		return false;
	} else if (bSteamID64 === null) {
		if (notifications) {
			GM_notification({
				title: "RaChart™ Enhancer",
				text: "Missing Steam ID64. Click to dismiss and not show again.",
				image: "http://i.imgur.com/f2OtaSe.png",
				highlight: false,
				timeout: 3,
				onclick: function() {
					GM_setValue("DismissedMissing", true);
				}
			});
		}

		return false;
	} else {
		return true;
	}
}


function confirmAuthor() {
	var blacklist = [];
	var author = document.getElementsByClassName('comment__username')[0].children[0].innerHTML;

	if (checkLst(author, blacklist) === false) {
		return true;
	} else {
		return false;
	}
}


function confirmRow(row) {
	if (row.children.length != 1) {
		return false;
	} if (row.getElementsByTagName("A").length < 1) {
		return false;
	} if (/store\.steampowered\.com/.test(row.getElementsByTagName("A")[0].href) === false) {
		return false;
	}

	return true;
}


function checkLoginStoreMethod(jsonFile) {
	if (jsonFile.rgWishlist.length === 0 && jsonFile.rgOwnedPackages.length === 0 && jsonFile.rgOwnedApps.length === 0) {
		return false;
	}

	return true;
}


// ========== INJECT FUNCTIONS ==========
function injectInterface() {
	injectDlgStyle();
	injectDialog();
	injectFunctions();
	injectRow();
}


function injectFunctions() {
	var scriptCode = [
		"function retrieveChecked() {",
		"	if (localStorage.getItem('MBlueTheme') == 'true') {",
		"		document.getElementById('MBlueTheme').checked = true;",
		"	}",
		"	if (localStorage.getItem('MDarkTheme') == 'true') {",
		"		document.getElementById('MDarkTheme').checked = true;",
		"	}",
		"	if (localStorage.getItem('SPDarkTheme') == 'true') {",
		"		document.getElementById('SPDarkTheme').checked = true;",
		"	}",
		"	var ownedColor = localStorage.getItem('RCE-OwnedColor');",
		"	var partiallyOwnedColor = localStorage.getItem('RCE-PartiallyOwnedColor');",
		"	var wishlistColor = localStorage.getItem('RCE-WishlistColor');",
		"	var ignoredColor = localStorage.getItem('RCE-IgnoredColor');",
		"	if (ownedColor !== null) {",
		"		document.getElementById('RCE-OwnedColor').value = ownedColor;",
		"	}",
		"	if (partiallyOwnedColor !== null) {",
		"		document.getElementById('RCE-PartiallyOwnedColor').value = partiallyOwnedColor;",
		"	}",
		"	if (wishlistColor !== null) {",
		"		document.getElementById('RCE-WishlistColor').value = wishlistColor;",
		"	}",
		"	if (ignoredColor !== null) {",
		"		document.getElementById('RCE-IgnoredColor').value = ignoredColor;",
		"	}",
		"	var bStoreMethod = localStorage.getItem('RCE-StoreMethod');",
		"	if (bStoreMethod !== null) {",
		"		document.getElementById('RCE-StoreMethod').checked = true;",
		"	}",
		"	var APIKey = localStorage.getItem('APIKey');",
		"	var SteamID64 = localStorage.getItem('SteamID64');",
		"	if (APIKey !== null) {",
		"		document.getElementById('APIKey').value = APIKey;",
		"	}",
		"	if (SteamID64 !== null) {",
		"		document.getElementById('SteamID64').value = SteamID64;",
		"	}",
		"}",
		"",
		"retrieveChecked();"
	].join("\n");
	var node = document.createElement('script');
	node.type = "text/javascript";
	node.appendChild(document.createTextNode(scriptCode));
	document.head.appendChild(node);
}


function injectRow() {
	var discDropdown = document.querySelector("a[class~='nav__button'][href='/discussions']");
	var newRow;

	if (discDropdown.previousElementSibling === null) {
		//Not logged in, create a new button on the header
		newRow = document.createElement("div");
		newRow.className = "nav__button-container";
		newRow.appendChild(document.createElement("a"));
		newRow.children[0].className = "nav__button";
		newRow.children[0].href = "javascript:void(0)";
		newRow.children[0].textContent = "RC Enhancer";

		document.getElementsByClassName("nav__left-container")[0].appendChild(newRow);

	} else {
		newRow = document.createElement('a');
		newRow.setAttribute('class', 'nav__row');
		newRow.href = "javascript:void(0)";

		discDropdown = discDropdown.previousElementSibling.firstElementChild;
		discDropdown.insertBefore(newRow, discDropdown.querySelector("a[class='nav__row'][href='/discussions/created']").nextElementSibling);


		newRow.appendChild(document.createElement('i'));
		newRow.children[0].setAttribute('class', 'icon-blue fa fa-fw fa-table');

		newRow.appendChild(document.createElement('div'));
		newRow.children[1].setAttribute('class', 'nav__row__summary');

		newRow.children[1].appendChild(document.createElement('p'));
		newRow.children[1].children[0].setAttribute('class', 'nav__row__summary__name');
		newRow.children[1].children[0].textContent = "RaChart™ Enhancer";

		newRow.children[1].appendChild(document.createElement('p'));
		newRow.children[1].children[1].setAttribute('class', 'nav__row__summary__description');
		newRow.children[1].children[1].textContent = "Change the options for the enhancer.";
	}


	newRow.addEventListener('click', function() {
		var blackbg = document.getElementById('black-background');
		var dlg = document.getElementById('dlg-box');
		blackbg.style.display = 'block';
		dlg.style.display = 'block';

		var winWidth = window.innerWidth;
		var winHeight = window.innerHeight;

		dlg.style.left = (winWidth/2) - 500/2 + 'px';
		dlg.style.top = '150px';
	});
}


function injectDialog() {
	var background = document.createElement('div');
	background.setAttribute('id', 'black-background');
	document.body.insertBefore(background, document.body.children[0]);

	var dlg = document.createElement('div');
	dlg.setAttribute('id', 'dlg-box');
	dlg.appendChild(document.createElement('div'));
	dlg.appendChild(document.createElement('div'));
	document.body.insertBefore(dlg, document.body.children[1]);

	var dlgHeader = dlg.children[0];
	dlgHeader.setAttribute('id', 'dlg-header');
	dlgHeader.appendChild(document.createElement('div'));
	dlgHeader.children[0].setAttribute('id', 'dlg-header-title');
	dlgHeader.children[0].textContent = "RaChart™ Enhancer";
	dlgHeader.appendChild(document.createElement('a'));
	dlgHeader.children[1].setAttribute('id', 'closeRCE');
	dlgHeader.children[1].href = "javascript:void(0)";
	dlgHeader.children[1].appendChild(document.createElement('i'));
	dlgHeader.children[1].children[0].setAttribute('class', 'fa fa-times');
	dlgHeader.children[1].children[0].style.fontSize = "25px";
	dlgHeader.children[1].children[0].style.marginTop = "-6px";

	var dlgBody = dlg.children[1];
	dlgBody.setAttribute('id', 'dlg-body');
	dlgBody.appendChild(document.createElement('label'));
	dlgBody.children[0].htmlFor = "APIKey";
	dlgBody.children[0].textContent = "API Key:";

	dlgBody.appendChild(document.createElement('input'));
	dlgBody.children[1].type = "textarea";
	dlgBody.children[1].setAttribute('id', 'APIKey');
	dlgBody.children[1].style.marginLeft = "35px";
	dlgBody.children[1].style.width = "300px";
	dlgBody.children[1].style.lineHeight = "inherit";

	dlgBody.appendChild(document.createElement('button'));
	dlgBody.children[2].setAttribute('class', 'RCE-button');
	dlgBody.children[2].style.marginLeft = "3px";
	dlgBody.children[2].textContent = "Submit";

	dlgBody.appendChild(document.createElement('br'));

	dlgBody.appendChild(document.createElement('label'));
	dlgBody.children[4].htmlFor = "SteamID64";
	dlgBody.children[4].textContent = "Steam ID64:";

	dlgBody.appendChild(document.createElement('input'));
	dlgBody.children[5].type = "textarea";
	dlgBody.children[5].setAttribute('id', 'SteamID64');
	dlgBody.children[5].style.marginLeft = "11px";
	dlgBody.children[5].style.width = "300px";
	dlgBody.children[5].style.lineHeight = "inherit";

	dlgBody.appendChild(document.createElement('button'));
	dlgBody.children[6].setAttribute('class', 'RCE-button');
	dlgBody.children[6].style.marginLeft = "3px";
	dlgBody.children[6].textContent = "Submit";

	dlgBody.appendChild(document.createElement('br'));

	dlgBody.appendChild(document.createElement('label'));
	dlgBody.children[8].htmlFor = "RCE-OwnedColor";
	dlgBody.children[8].textContent = "Owned color:";
	dlgBody.children[8].style.marginRight = "8px";

	dlgBody.appendChild(document.createElement('input'));
	dlgBody.children[9].type = "color";
	dlgBody.children[9].setAttribute('id', 'RCE-OwnedColor');
	dlgBody.children[9].style.width = "170px";
	dlgBody.children[9].style.marginLeft = "51px";
	dlgBody.children[9].style.lineHeight = "inherit";

	dlgBody.appendChild(document.createElement('button'));
	dlgBody.children[10].setAttribute('class', 'RCE-button');
	dlgBody.children[10].style.marginLeft = "3px";
	dlgBody.children[10].textContent = "Submit";

	dlgBody.appendChild(document.createElement('br'));

	dlgBody.appendChild(document.createElement('label'));
	dlgBody.children[12].htmlFor = "RCE-PartiallyOwnedColor";
	dlgBody.children[12].textContent = "Partially owned color:";
	dlgBody.children[12].style.marginRight = "8px";

	dlgBody.appendChild(document.createElement('input'));
	dlgBody.children[13].type = "color";
	dlgBody.children[13].setAttribute('id', 'RCE-PartiallyOwnedColor');
	dlgBody.children[13].style.width = "170px";
	dlgBody.children[13].style.lineHeight = "inherit";

	dlgBody.appendChild(document.createElement('button'));
	dlgBody.children[14].setAttribute('class', 'RCE-button');
	dlgBody.children[14].style.marginLeft = "3px";
	dlgBody.children[14].textContent = "Submit";

	dlgBody.appendChild(document.createElement('br'));

	dlgBody.appendChild(document.createElement('label'));
	dlgBody.children[16].htmlFor = "RCE-WishlistColor";
	dlgBody.children[16].textContent = "Wishlist color:";
	dlgBody.children[16].style.marginRight = "8px";

	dlgBody.appendChild(document.createElement('input'));
	dlgBody.children[17].type = "color";
	dlgBody.children[17].setAttribute('id', 'RCE-WishlistColor');
	dlgBody.children[17].style.width = "170px";
	dlgBody.children[17].style.marginLeft = "47px";
	dlgBody.children[17].style.lineHeight = "inherit";

	dlgBody.appendChild(document.createElement('button'));
	dlgBody.children[18].setAttribute('class', 'RCE-button');
	dlgBody.children[18].style.marginLeft = "3px";
	dlgBody.children[18].textContent = "Submit";

	dlgBody.appendChild(document.createElement('br'));

	dlgBody.appendChild(document.createElement('label'));
	dlgBody.children[20].htmlFor = "RCE-IgnoredColor";
	dlgBody.children[20].textContent = "Ignored apps color";
	dlgBody.children[20].style.marginRight = "8px";

	dlgBody.appendChild(document.createElement('input'));
	dlgBody.children[21].type = "color";
	dlgBody.children[21].setAttribute('id', 'RCE-IgnoredColor');
	dlgBody.children[21].style.width = "170px";
	dlgBody.children[21].style.marginLeft = "16px";
	dlgBody.children[21].style.lineHeight = "inherit";

	dlgBody.appendChild(document.createElement('button'));
	dlgBody.children[22].setAttribute('class', 'RCE-button');
	dlgBody.children[22].style.marginLeft = "3px";
	dlgBody.children[22].textContent = "Submit";

	dlgBody.appendChild(document.createElement('button'));
	dlgBody.children[23].setAttribute('class', 'RCE-button');
	dlgBody.children[23].textContent = "Reset colors";
	dlgBody.children[23].style.width = "70px";
	dlgBody.children[23].style.fontSize = "10px";
	dlgBody.children[23].style.marginTop = "-50px";
	dlgBody.children[23].style.float = "right";

	dlgBody.appendChild(document.createElement('br'));
	dlgBody.children[24].style.lineHeight = "30px";

	dlgBody.appendChild(document.createElement('div'));
	dlgBody.children[25].title = "The store method allows for more accurate fetching (includes packages and DLCs owned, as well as wishlist and ignored apps) but requires you to be logged into the Steam store to work, and will only work with the account logged into the store";
	dlgBody.children[25].appendChild(document.createElement('label'));
	dlgBody.children[25].children[0].htmlFor = "RCE-StoreMethod";
	dlgBody.children[25].children[0].textContent = "Check to use the Steam store method for fetching ";
	dlgBody.children[25].appendChild(document.createElement('input'));
	dlgBody.children[25].children[1].setAttribute('id', 'RCE-StoreMethod');
	dlgBody.children[25].children[1].type = "checkbox";
	dlgBody.children[25].children[1].style.width = "inherit";
	dlgBody.children[25].children[1].style.marginTop = "10px";


	dlgBody.appendChild(document.createElement('label'));
	dlgBody.children[26].htmlFor = "MBlueTheme";
	dlgBody.children[26].appendChild(document.createElement('a'));
	dlgBody.children[26].children[0].href = "https://www.steamgifts.com/discussion/62TRf/";
	dlgBody.children[26].children[0].target = "_blank";
	dlgBody.children[26].children[0].textContent = "Check this if you use Mully's Blue Theme";
	dlgBody.children[26].children[0].style.color = "#115a8e";
	dlgBody.children[26].children[0].style.textDecoration = "underline";

	dlgBody.appendChild(document.createElement('input'));
	dlgBody.children[27].setAttribute('id', 'MBlueTheme');
	dlgBody.children[27].type = "checkbox";
	dlgBody.children[27].style.width = "inherit";
	dlgBody.children[27].style.marginTop = "10px";
	dlgBody.children[27].style.marginLeft = "3px";

	dlgBody.appendChild(document.createElement('br'));

	dlgBody.appendChild(document.createElement('label'));
	dlgBody.children[29].htmlFor = "MDarkTheme";
	dlgBody.children[29].appendChild(document.createElement("a"));
	dlgBody.children[29].children[0].href = "https://www.steamgifts.com/discussion/62TRf/";
	dlgBody.children[29].children[0].target = "_blank";
	dlgBody.children[29].children[0].textContent = "Check this if you use Mully's Dark Theme";
	dlgBody.children[29].children[0].style.color = "#115a8e";
	dlgBody.children[29].children[0].style.textDecoration = "underline";

	dlgBody.appendChild(document.createElement('input'));
	dlgBody.children[30].setAttribute('id', 'MDarkTheme');
	dlgBody.children[30].type = "checkbox";
	dlgBody.children[30].style.width = "inherit";
	dlgBody.children[30].style.marginTop = "2px";
	dlgBody.children[30].style.marginLeft = "3px";

	dlgBody.appendChild(document.createElement('br'));

	dlgBody.appendChild(document.createElement('label'));
	dlgBody.children[32].htmlFor = "SPDarkTheme";
	dlgBody.children[32].appendChild(document.createElement("a"));
	dlgBody.children[32].children[0].href = "https://www.steamgifts.com/discussion/iO230/";
	dlgBody.children[32].children[0].target = "_blank";
	dlgBody.children[32].children[0].textContent = "Check this if you use SquishedPotatoe's Dark Theme";
	dlgBody.children[32].children[0].style.color = "#115a8e";
	dlgBody.children[32].children[0].style.textDecoration = "underline";

	dlgBody.appendChild(document.createElement('input'));
	dlgBody.children[33].setAttribute('id', 'SPDarkTheme');
	dlgBody.children[33].type = "checkbox";
	dlgBody.children[33].style.width = "inherit";
	dlgBody.children[33].style.marginTop = "2px";
	dlgBody.children[33].style.marginLeft = "3px";

	dlgBody.appendChild(document.createElement('h2'));
	dlgBody.children[34].style.float = "right";
	dlgBody.children[34].style.marginTop = "-2px";
	dlgBody.children[34].appendChild(document.createElement('a'));
	dlgBody.children[34].children[0].href = "https://www.steamgifts.com/discussion/riOvr/";
	dlgBody.children[34].children[0].style.color = "#FFFFFF";
	dlgBody.children[34].children[0].style.fontSize = "20px";
	dlgBody.children[34].children[0].style.fontStyle = "italic";
	dlgBody.children[34].children[0].style.textDecoration = "underline";
	dlgBody.children[34].children[0].textContent = "Thread";


	background.addEventListener('click', function() {
		var blackbg = document.getElementById('black-background');
		var dlg = document.getElementById('dlg-box');

		blackbg.style.display = 'none';
		dlg.style.display = 'none';
	});

	dlgHeader.children[1].addEventListener('click', function() {
		var blackbg = document.getElementById('black-background');
		var dlg = document.getElementById('dlg-box');

		blackbg.style.display = 'none';
		dlg.style.display = 'none';
	});

	dlgBody.children[2].addEventListener('click', function() {
		var input = document.getElementById('APIKey');
		input.value = input.value.trim();
		if (input.value.length > 25 && input.value === input.value.toUpperCase() && /^[A-Z0-9]+$/.test(input.value)) {
			localStorage.setItem(input.id, input.value);

			GM_deleteValue("DismissedMissing");
		} else {
			alert("Not a valid API key (too short, or not fully uppercase, or contains non-alphanumeric characters)");
		}
	});

	dlgBody.children[6].addEventListener('click', function() {
		var input = document.getElementById('SteamID64');
		input.value = input.value.trim();
		if (input.value.length === 17 && /^[0-9]+$/.test(input.value)) {
			localStorage.setItem(input.id, input.value);

			GM_deleteValue("DismissedMissing");
		} else {
			alert("Not a valid Steam ID64 (not the correct length, or contains non-numeric characters)");
		}
	});

	dlgBody.children[10].addEventListener('click', function() {
		//Owned color
		var input = dlgBody.children[9];
		localStorage.setItem(input.id, input.value);
	});

	dlgBody.children[14].addEventListener('click', function() {
		//Partially owned color
		var input = dlgBody.children[13];
		localStorage.setItem(input.id, input.value);
	});

	dlgBody.children[18].addEventListener('click', function () {
		//Wishlist color
		var input = dlgBody.children[17];
		localStorage.setItem(input.id, input.value);
	});

	dlgBody.children[22].addEventListener('click', function() {
		//Ignored apps color
		var input = dlgBody.children[21];
		localStorage.setItem(input.id, input.value);
	});

	dlgBody.children[23].addEventListener('click', function() {
		localStorage.removeItem('RCE-OwnedColor');
		localStorage.removeItem('RCE-PartiallyOwnedColor');
		localStorage.removeItem('RCE-WishlistColor');
		localStorage.removeItem('RCE-IgnoredColor');
	});

	dlgBody.children[25].children[1].addEventListener('click', function() {
		//Using store method
		var input = dlgBody.children[25].children[1];
		if (input.checked === false) {
			localStorage.removeItem(input.id);
		} else {
			localStorage.setItem(input.id, true);
		}
	});

	dlgBody.children[27].addEventListener('click', function() {
		//Mully's Blue Theme
		var input = dlgBody.children[27];
		if (input.checked === false) {
			localStorage.removeItem(input.id);
		} else {
			localStorage.setItem(input.id, true);
		}
	});

	dlgBody.children[30].addEventListener('click', function() {
		//Mully's Dark Theme
		var input = dlgBody.children[30];
		if (input.checked === false) {
			localStorage.removeItem(input.id);
		} else {
			localStorage.setItem(input.id, true);
		}
	});

	dlgBody.children[33].addEventListener('click', function() {
		//SquishedPotatoe's Dark Theme
		var input = dlgBody.children[33];
		if (input.checked === false) {
			localStorage.removeItem(input.id);
		} else {
			localStorage.setItem(input.id, true);
		}
	});

	dragElement(dlg);
}


function injectDlgStyle() {
	var dialogCSS = [
			"#black-background {",
			"  display: none;",
			"  width: 100%;",
			"  height: 100%;",
			"  position: fixed;",
			"  top: 0px;",
			"  left: 0px;",
			"  background-color: rgba(0, 0, 0, 0.75);",
			"  z-index: 8888;",
			"}",
			"#dlg-box{",
			"  display: none;",
			"  position: fixed;",
			"  width: 500px;",
			"  z-index: 9999;",
			"  border-radius: 10px;",
			"  background-color: #7c7d7e;",
			"}",
			"#dlg-header {",
			"  background-color: #6D84B4;",
			"  padding: 10px;",
			"  padding-bottom: 30px;",
			"  margin: 10px 10px 10px 10px;",
			"  color: white;",
			"  font-size: 20px;",
			"  cursor: move;",
			"}",
			"#dlg-header-title {",
			"  float: left;",
			"}",
			"#dlg-body{",
			"  clear: both;",
			"  background-color: #C3C3C3;",
			"  color: #000000;",
			"  font-size: 14px;",
			"  padding: 10px;",
			"  margin: 0px 10px 10px 10px;",
			"}",
			"#closeRCE {",
			"  background-color: transparent;",
			"  color: white;",
			"  float: right;",
			"  border: none;",
			"  font-size: 25px;",
			"  margin-top: -5px;",
			"  opacity: 0.7;",
			"}",
			".RCE-button{",
			"  background-color: #fff;",
			"  border: 2px solid #333;",
			"  box-shadow: 1px 1px 0 #333,",
			"			  2px 2px 0 #333,",
			"			  3px 3px 0 #333,",
			"			  4px 4px 0 #333,",
			"			  5px 5px 0 #333;",
			"  color: #333;",
			"  display: inline-block;",
			"  padding: 4px 6px;",
			"  position: relative;",
			"  text-decoration: none;",
			"  text-transform: uppercase;",
			"  -webkit-transition: .1s;",
			"	 -moz-transition: .1s;",
			"	  -ms-transition: .1s;",
			"	   -o-transition: .1s;",
			"		  transition: .1s;",
			"}",
			".RCE-button:hover,",
			".RCE-button:focus {",
			"  background-color: #edd;",
			"}",
			".RCE-button:active {",
			"  box-shadow: 1px 1px 0 #333;",
			"  left: 4px;",
			"  top: 4px;",
			"}",
			//For SquishedPotatoe's Dark Theme
			".markdown td {",
			"  background-color: inherit !important;",
			"}"
	].join("\n");
	var node = document.createElement('style');
	node.type = "text/css";
	node.appendChild(document.createTextNode(dialogCSS));
	document.getElementsByTagName('head')[0].appendChild(node);
}


function injectHighlightStyle() {
	var data = {};

	// Get stored values of highlight colours and/or default theme values
	data.OwnedColor = localStorage.getItem('RCE-OwnedColor');
	data.PartiallyOwnedColor = localStorage.getItem('RCE-PartiallyOwnedColor');
	data.WishlistColor = localStorage.getItem('RCE-WishlistColor');
	data.IgnoredColor = localStorage.getItem('RCE-IgnoredColor');
	data.MBlueTheme = localStorage.getItem('MBlueTheme');
	data.MDarkTheme = localStorage.getItem('MDarkTheme');
	data.SPDarkTheme = localStorage.getItem('SPDarkTheme');

	var dialogCSS = [
		".RCE-owned, .RCE-partially-owned, .RCE-wishlist, .RCE-ignored {",
		"  text-shadow: none;",
		"}"
	];

	// Figure out and add owned color
	dialogCSS.push(".RCE-owned {");

	if (data.OwnedColor !== null) {
		dialogCSS.push("  background-color: {0} !important;".format(data.OwnedColor));
	} else if (data.MBlueTheme !== null && data.MBlueTheme !== undefined && data.MBlueTheme != false) {
		dialogCSS.push("  background-color: {0} !important;".format(OWNED_MBLUE));
	} else if (data.MDarkTheme !== null && data.MDarkTheme !== undefined && data.MDarkTheme != false) {
		dialogCSS.push("  background-color: {0} !important;".format(OWNED_MDARK));
	} else if (data.SPDarkTheme !== null && data.SPDarkTheme !== undefined && data.SPDarkTheme != false) {
		dialogCSS.push("  background-color: {0} !important;".format(OWNED_SPDARK));
	} else {
		dialogCSS.push("  background-color: {0} !important;".format(OWNED_DEFAULT));
	}

	dialogCSS.push("}");

	// Figure out and add partially owned color
	dialogCSS.push(".RCE-partially-owned {");

	if (data.PartiallyOwnedColor !== null) {
		dialogCSS.push("  background-color: {0} !important;".format(data.PartiallyOwnedColor));
	} else if (data.MBlueTheme !== null && data.MBlueTheme !== undefined && data.MBlueTheme != false) {
		dialogCSS.push("  background-color: {0} !important;".format(PARTIALLY_OWNED_MBLUE));
	} else if (data.MDarkTheme !== null && data.MDarkTheme !== undefined && data.MDarkTheme != false) {
		dialogCSS.push("  background-color: {0} !important;".format(PARTIALLY_OWNED_MDARK));
	} else if (data.SPDarkTheme !== null && data.SPDarkTheme !== undefined && data.SPDarkTheme != false) {
		dialogCSS.push("  background-color: {0} !important;".format(PARTIALLY_OWNED_SPDARK));
	} else {
		dialogCSS.push("  background-color: {0} !important;".format(PARTIALLY_OWNED_DEFAULT));
	}

	dialogCSS.push("}");

	// Figure out and add wishlist color
	dialogCSS.push(".RCE-wishlist {");

	if (data.WishlistColor !== null) {
		dialogCSS.push("  background-color: {0} !important;".format(data.WishlistColor));
	} else if (data.MBlueTheme !== null && data.MBlueTheme !== undefined && data.MBlueTheme != false) {
		dialogCSS.push("  background-color: {0} !important;".format(WISHLIST_MBLUE));
	} else if (data.MDarkTheme !== null && data.MDarkTheme !== undefined && data.MDarkTheme != false) {
		dialogCSS.push("  background-color: {0} !important;".format(WISHLIST_MDARK));
	} else if (data.SPDarkTheme !== null && data.SPDarkTheme !== undefined && data.SPDarkTheme != false) {
		dialogCSS.push("  background-color: {0} !important;".format(WISHLIST_SPDARK));
	} else {
		dialogCSS.push("  background-color: {0} !important;".format(WISHLIST_DEFAULT));
	}

	dialogCSS.push("}")

	// Figure out and add ignored color
	dialogCSS.push(".RCE-ignored {");

	if (data.IgnoredColor !== null) {
		dialogCSS.push("  background-color: {0} !important;".format(data.IgnoredColor));
	} else if (data.MBlueTheme !== null && data.MBlueTheme !== undefined && data.MBlueTheme != false) {
		dialogCSS.push("  background-color: {0} !important;".format(IGNORED_MBLUE));
	} else if (data.MDarkTheme !== null && data.MDarkTheme !== undefined && data.MDarkTheme != false) {
		dialogCSS.push("  background-color: {0} !important;".format(IGNORED_MDARK));
	} else if (data.SPDarkTheme !== null && data.SPDarkTheme !== undefined && data.SPDarkTheme != false) {
		dialogCSS.push("  background-color: {0} !important;".format(IGNORED_SPDARK));
	} else {
		dialogCSS.push("  background-color: {0} !important;".format(IGNORED_DEFAULT));
	}

	dialogCSS.push("}");

	dialogCSS = dialogCSS.join("\n");

	var node = document.createElement('style');
	node.type = 'text/css';
	node.appendChild(document.createTextNode(dialogCSS));
	document.getElementsByTagName('head')[0].appendChild(node);
}



// ========== HIGHLIGHT FUNCTIONS ==========
function highlight(id, type) {
	// Arguments for type:
	//   0 - Owned
	//   1 - Partially owned
	//   2 - Wishlist
	//   3 - Ignored
	// id will be a string such as app/1234

	var rows = document.getElementsByClassName(id);

	for (var i = 0; i < rows.length; i++) {
		if (type === 0) {
			rows[i].className += " RCE-owned";
		} else if (type === 1) {
			rows[i].className += " RCE-partially-owned";
		} else if (type === 2) {
			rows[i].className += " RCE-wishlist";
		} else if (type === 3) {
			rows[i].className += " RCE-ignored";
		}
	}
}



// ========== SCAN FUNCTIONS ==========
function scanTable() {
	//Make tables sortable
	var tables = document.getElementsByTagName('table');
	for (var j = 0; j < tables.length; j++) {
		tables[j].className += " sortable";
	}

	var elements = document.getElementsByTagName('td');
	var appIDs = new Set();
	var subIDs = new Set();

	for (var i = 0; i < elements.length; i++) {
		if (confirmRow(elements[i]) === false) {
			continue;
		}

		var id;
		var link = elements[i].getElementsByTagName("A")[0].href;
		if (/app/.test(link)) {
			id = /\d+/.exec(link)[0];
			appIDs.add(id);
			elements[i].parentNode.setAttribute('class', "app/{0}".format(id));
		} else if (/sub/.test(link)) {
			id = /\d+/.exec(link)[0];
			subIDs.add(id);
			elements[i].parentNode.setAttribute('class', "sub/{0}".format(id));
		}
	}

	return [Array.from(appIDs), Array.from(subIDs)];
}



// ========== UTILITY FUNCTIONS ==========
function turnToIntArray(oldArray) {
	var newArray = [];
	for (var i = 0; i < oldArray.length; i++) {
		newArray.push(parseInt(oldArray[i]));
	}

	return newArray;
}


function checkLst(value, list) {
	if (list.indexOf(value) === -1) {
		return false;
	} else {
		return true;
	}
}


function refractorStorage() {
	var ownedColor = localStorage.getItem('PrimaryColor');
	var partiallyOwnedColor = localStorage.getItem('SecondaryColor');

	if (ownedColor !== null) {
		localStorage.setItem('RCE-OwnedColor', ownedColor);
		localStorage.removeItem('PrimaryColor');
	}

	if (partiallyOwnedColor !== null) {
		localStorage.setItem('RCE-PartiallyOwnedColor', partiallyOwnedColor);
		localStorage.removeItem('SecondaryColor');
	}
}


function orderedMatchingAlgorithm(array1, array2, customFunction = null) {
	var notMatched = [];

	array1.sort(function(a, b) {
		return a - b;
	});

	array2.sort(function(a, b) {
		return a - b;
	});

	var i = 0;
	var j = 0;

	while (true) {
		if (i >= array1.length || j >= array2.length) {
			if (i < array1.length) {
				for (var z = i; z < array1.length; z++) {
					notMatched.push(array1[z]);
				}
			}

			break;
		}

		if (array1[i] === array2[j]) {
			if (customFunction !== null) {
				customFunction(array1[i]);
			}

			i++;
			j++;
		} else if (array1[i] < array2[j]) {
			notMatched.push(array1[i]);

			i++;
		} else if (array1[i] > array2[j]) {
			j++;
		}
	}

	return notMatched;
}
