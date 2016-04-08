// Global objects
function JumpStart(options)
{
	this.version = "0.2.0";

	// Only allow ONE instance
	if( window.hasOwnProperty("jumpStart") )
		return;

	// Display some info into the console for devs
	var helpText = "";
	helpText += "***************************\n";
	helpText += "**** JumpStart  v" + this.version + " ****\n";
	helpText += "***************************";

	if( !(window.hasOwnProperty("altspace") && window.altspace.inClient) )
	{
		helpText += "\n**** Web Controls:     ****\n";
		helpText += "****  WASD - Movement  ****\n";
		helpText += "****  RMB  - Set Look  ****\n";
		helpText += "***************************";
	}

	console.log(helpText);

	// Variable values will be filled in ASAP, but declare them all here for sanity.
	// Fire onPrecache when there's enough of JumpStart loaded for the app to specify what IT needs preloaded.
	// Fire onReady when everything is preloaded & the system is ready but NOT ticking.
	// Fire onTick every tick after the app has started the simulation.

	// List all PUBLIC member variables
	var publicVariables = [
		"roomID",	// Given in the URI query as "room". null if none.
		"isAltspace",	// Altspace or web mode
		"isGear",
		"isInitialized",
		"isReady",
		"isRunning",
		"isEnclosure",	// Enclosure or personal browser
		"camera",
		"renderer",
		"clock",
		"raycaster",
		"cursorRay",
		"enclosure",
		"localUser",
		"scene",
		"world",
		"worldOffset",
		"deltaTime",
		"elapsedTime",
		"crosshair",
		"gamepads",
		"activeGamepadIndex",
		"previousGamepadStates"
	];

	// Declare them all as null
	var i;
	for( i in publicVariables )
		this[publicVariables[i]] = null;

	// List all PRIVATE member variables
	var privateVariables = [
		"state",	// 0: ready for setOptions	1: ready for precacheFile and doneCaching	2: ready for run	3: running // IS THIS ACTUALLY USED?
		"options",
		"futureCursorRay",
		"clickedObject",
		"hoveredObject",
		"webLook",
		"webLookPrev",
		"webMouse",
		"boundFadeObjects",
		"invisibleMaterial",
		"models",
		"objects",
		"sounds",
		"cursorPlanes",
		"enclosureBoundaries",
		"behaviors",
		"listeners",
		"syncedObjects",
		"pendingUpdates",
		"firebase",
		"pendingEvents",
		"selfSyncingObject",	// Used to avoid syncing to updates that we locally send
		"doneCaching",
		"audioContext",	// For precaching sounds, etc.
		"raycastArray",	// gets used locally every tick
		"freshObjects", // a list of objects that were spawned in the current tick
		"debug"	// Helper class
		//"octree"	// Octree disabled for now
	];

	// Declare them all as null
	for( i in privateVariables )
		this[privateVariables[i]] = null;

	// Set as many synchronous non-null PUBLIC member variables as possible
	this.roomID = this.getQueryVariable("room");
	this.isAltspace = (window.hasOwnProperty("altspace") && window.altspace.inClient);
	this.isGear = navigator.userAgent.match(/mobile/i);
	this.isInitialized = false;
	this.isReady = false;
	this.isRunning = false;
	this.gamepads = (this.isAltspace) ? altspace.getGamepads() : navigator.getGamepads();
	this.activeGamepadIndex = -1;
	this.previousGamepadStates = [];
	this.hoveredObject = null;
	this.clickedObject = null;

	// Set as many synchronous non-null PRIVATE member veriables as possible 
	this.options =
	{
		"appID": "example",
		"multiuserOnly": false,
		"enclosureOnly": true,
		"sceneScale": 1.0,	// relative scale
		"scaleWithEnclosure": true,	// false means consistent size, regardless of enclosure size
		"timeScale": 1.0,
		"webControls": true,
		"debug":
		{
			"showCursorPlanes": false
		},
		"camera":
		{
			"position": {x: 200, y: 240, z: 800}
		}
	};
	this.firebase = {
		"rootRef": null,
		"roomRef": null,
		"state": null,
		"isLocallyInitializing": false
	};
	this.models = [];
	this.objects = {};
	this.sounds = {};
	this.syncedObjects = {};
	this.pendingUpdates = {};
	this.raycastArray = [];
	this.freshObjects = [];
	this.cursorPlanes = {};
	this.pendingEvents = {};
	this.selfSyncingObject = false;
	this.audioContext = new (window.webkitAudioContext || window.AudioContext)();
	this.enclosureBoundaries = 
	{
		"floor": null,
		"ceiling": null,
		"north": null,
		"east": null,
		"south": null,
		"west": null
	};
	this.behaviors = {
		"footballPass":
		{
			"applyBehavior": function(options)
			{
				// REQUIRED: targetPosition, originalPosition
				this.syncData.footballPass = 
				{
					"targetPosition": options.targetPosition,
					"originalPosition": options.originalPosition,
					"height": (!!options.height) ? options.height : 100.0,
					"callbackFuncName": (!!options.callbackFuncName) ? options.callbackFuncName : "defaultCallback"
				}

				var distance = options.targetPosition.distanceTo(options.originalPosition);
				var autoSpeed = 50 + (0.9 * distance);
				this.syncData.footballPass.time = distance / autoSpeed;

				this.addEventListener("tick", jumpStart.behaviors.footballPass.tickBehavior);
				return true;
			},
			"defaultCallback": function()
			{

			},
			"removeOnFinish": function()
			{
				jumpStart.removeInstance(this);
			},
			"tickBehavior": function()
			{
				if( !!!this.userData.footballPass )
					this.userData.footballPass = {"amount": 0.0};

				if( this.userData.footballPass.amount < 1.0 )
				{
					this.userData.footballPass.amount += jumpStart.deltaTime / this.syncData.footballPass.time;

					var justFinished = false;
					if( this.userData.footballPass.amount >= 1.0 )
					{
						this.userData.footballPass.amount = 1.0;
						justFinished = true;
					}

					this.position.lerpVectors(this.syncData.footballPass.originalPosition, this.syncData.footballPass.targetPosition, this.userData.footballPass.amount);

					var amount = this.userData.footballPass.amount;
					amount *= 2.0;

					if( amount <= 1 )
					{
						amount = 1 - amount;
						amount *= amount;
						this.position.y += this.syncData.footballPass.height - (amount * this.syncData.footballPass.height);
					}
					else
					{
						amount -= 1;
						amount *= amount;
						this.position.y += this.syncData.footballPass.height - (amount * this.syncData.footballPass.height);
					}

					if( justFinished )
					{
						jumpStart.behaviors.footballPass[this.syncData.footballPass.callbackFuncName].call(this);
						//jumpStart.removeInstance(ball);
					}
				}
			}
		},
		"autoRemoval":
		{
			"applyBehavior": function(options)
			{
				this.syncData.autoRemoval = {};
				this.syncData.autoRemoval.heartbeats = 0;
				this.syncData.autoRemoval.flatlineDelay = (!!options.flatlineDelay) ? options.flatlineDelay : 10.0;
				this.syncData.autoRemoval.adopterID = 0;
				this.addEventListener("tick", jumpStart.behaviors.autoRemoval.tickBehavior);
				return true;
			},
			"unapplyBehavior": function()
			{
				delete this.syncData["autoRemoval"];
				delete this.userData["autoRemoval"];
				return true;
			},
			"tickBehavior": function()
			{
				var isOwner = (this.ownerID === jumpStart.localUser.userID);
				if( !!!this.userData.autoRemoval )
					this.userData.autoRemoval = {
						"previousHeartbeats": this.syncData.autoRemoval.heartbeats,
						"time": (isOwner) ? 0 : jumpStart.elapsedTime
					};

				if( isOwner )
				{
					// As the owner, we just increase the heartbeats value according to the rate & do a shallow sync each time.
					this.userData.autoRemoval.time += jumpStart.deltaTime;
					if( this.userData.autoRemoval.time >= this.syncData.autoRemoval.flatlineDelay / 2.0 )
					{
						this.userData.autoRemoval.time = 0;
						this.syncData.autoRemoval.heartbeats = this.syncData.autoRemoval.heartbeats + 1;
						this.sync({"vitalData": true, "syncData": true});
					}
				}
				else
				{
					// As a client, we monitor the time since the last heartbeats change and remove this object if it needs to be.
					if( this.syncData.autoRemoval.heartbeats !== this.userData.autoRemoval.previousHeartbeats )
					{
						this.userData.autoRemoval.previousHeartbeats = this.syncData.autoRemoval.heartbeats;
						this.userData.autoRemoval.time = jumpStart.elapsedTime;
					}
					else if( jumpStart.elapsedTime - this.userData.autoRemoval.time >= this.syncData.autoRemoval.flatlineDelay )
					{
						// 1. Set the ownerID to 0.
						// 2. Set us as the adopterID on the firebase.
						// 3. Wait flatlineDelay/2.0 more seconds
						// 4. If we are still the adopterID, take control of this item and remove it.

						if( !this.syncData.autoRemoval.adopterID )
						{
							this.syncData.autoRemoval.adopterID = jumpStart.localUser.userID;
							this.sync({"syncData": true});
						}
						else if( this.syncData.autoRemoval.adopterID === jumpStart.localUser.userID && jumpStart.elapsedTime - this.userData.autoRemoval.time >= this.syncData.autoRemoval.flatlineDelay * 1.5 )
						{
							// Take control
							this.ownerID = jumpStart.localUser.userID;
							this.syncData.autoRemoval.adopterID = 0;
							this.syncData.autoRemoval.heartbeats = this.syncData.autoRemoval.heartbeats + 1;
							this.userData.autoRemoval.time = 0;

							// Remove us the next tick cycle, to avoid immediate respawn issues.
							this.addEventListener("tick", function()
							{
								jumpStart.removeInstance(this);
							});

							this.sync();
						}
					}
				}
			}
		},
		"autoSync":
		{
			"applyBehavior": function(options)
			{
				this.userData.autoSync = {};
				this.userData.autoSync.distanceTolerance = (!!options.distanceTolerance) ? options.distanceTolerance : 5.0;
				this.userData.autoSync.minInterval = (!!options.minInterval) ? options.minInterval : 0.2;
				this.addEventListener("tick", jumpStart.behaviors.autoSync.tickBehavior);
				return true;
			},
			"unapplyBehavior": function()
			{
				delete this.syncData["autoSync"];
				delete this.userData["autoSync"];
				this.removeEventListener("tick", jumpStart.behaviors.autoSync.tickBehavior);
				this.removeEventListener("spawn", jumpStart.behaviors.autoSync.spawnBehavior);
				return true;
			},
			"tickBehavior": function()
			{
				if( !!!this.userData.autoSync )
					this.userData.autoSync = {};

				// Only auto-sync objects we own
				if( this.ownerID !== jumpStart.localUser.userID )
					return;

				var shouldSync = false;
				if( !!!this.userData.autoSync.previousPosition || !!!this.userData.autoSync.previousTime )
					shouldSync = true;

				if( !shouldSync && jumpStart.elapsedTime - this.userData.autoSync.previousTime > this.userData.autoSync.minInterval && this.position.distanceTo(this.userData.autoSync.previousPosition) > this.userData.autoSync.distanceTolerance )
					shouldSync = true;

				if( shouldSync )
				{
					if( !!!this.userData.autoSync.previousPosition )
						this.userData.autoSync.previousPosition = new THREE.Vector3();

					this.userData.autoSync.previousPosition.copy(this.position);
					this.userData.autoSync.previousTime = jumpStart.elapsedTime;
					this.sync();
				}
			}
		},
		"shrinkRemove":
		{
			"applyBehavior": function(options)
			{
				this.userData.shrinkRemove = {};
				this.userData.shrinkRemove.speed = (!!options.speed) ? options.speed : 1.0;
				this.userData.shrinkRemove.delay = (!!options.delay) ? options.delay : 0.0;
				this.addEventListener("tick", jumpStart.behaviors.shrinkRemove.tickBehavior);
				return true;
			},
			"tickBehavior": function()
			{
				this.userData.shrinkRemove.delay -= jumpStart.deltaTime;

				if( this.userData.shrinkRemove.delay <= 0 )
				{
					this.scale.x -= this.userData.shrinkRemove.speed * jumpStart.deltaTime;
					this.scale.y -= this.userData.shrinkRemove.speed * jumpStart.deltaTime;
					this.scale.z -= this.userData.shrinkRemove.speed * jumpStart.deltaTime;

					if( this.scale.x <= 0.0001 )
						jumpStart.removeInstance(this);
				}
			}
		},
		"physics": {
			"applyBehavior": function(options)
			{
				if( !!!options )
					options = {};

				if( !!!this.behaviors.physics )
				{
					// This is our 1st time applying ourselves
					this.syncData.physics = {
						"force": (!!options.force) ? options.force.clone() : new THREE.Vector3(),
						"rotation": (!!options.rotation) ? options.rotation.clone() : new THREE.Vector3((Math.PI / 2.0) * Math.random(), (Math.PI / 2.0) * Math.random(), (Math.PI / 2.0) * Math.random())
					};

					this.userData.physics = {
						"velocity": this.syncData.physics.force.clone()
					};

					this.addEventListener("tick", jumpStart.behaviors.physics.tickBehavior);
					this.addEventListener("spawn", jumpStart.behaviors.physics.spawnBehavior);
				}
				else
				{
					// We are updating an exiting physics behavior with a new force & rotation
					if( !!options.force )
						this.syncData.physics.force.copy(options.force);
					else
						this.syncData.physics.force.set(0, 0, 0);

					if( !!options.rotation )
						this.syncData.physics.rotation.copy(options.rotation);
					else
						this.syncData.physics.rotation.set(0, 0, 0);

					this.userData.physics.velocity.copy(this.syncData.physics.force);
				}

				return true;
			},
			"unapplyBehavior": function()
			{
				delete this.syncData["physics"];
				delete this.userData["physics"];
				this.removeEventListener("tick", jumpStart.behaviors.physics.tickBehavior);
				this.removeEventListener("spawn", jumpStart.behaviors.physics.spawnBehavior);
				return true;
			},
			"tickBehavior": function()
			{
				this.userData.physics.velocity.y -= 9.8 * jumpStart.deltaTime;

				// Terminal velocity because we have no air drag
				var termVel = 50.0;
				var velLen = this.userData.physics.velocity.length();
				if( velLen > termVel )
					this.userData.physics.velocity.multiplyScalar(0.9);

				// Update the rotation
				this.rotateX((this.syncData.physics.rotation.x * 5.0) * jumpStart.deltaTime);
				this.rotateY((this.syncData.physics.rotation.y * 5.0) * jumpStart.deltaTime);
				this.rotateZ((this.syncData.physics.rotation.z * 5.0) * jumpStart.deltaTime);

				// Bounce us off of walls
				var maximums = {
					"x": jumpStart.enclosure.innerWidth / 2.0,
					"y": (jumpStart.enclosure.innerHeight / 2.0),
					"z": jumpStart.enclosure.innerDepth / 2.0
				};

				this.updateMatrixWorld();
				var pos = new THREE.Vector3().setFromMatrixPosition(this.matrixWorld);
				var deltaPos = this.userData.physics.velocity.clone().multiplyScalar(jumpStart.deltaTime * 100.0)
				pos.add(deltaPos);

				var x, max;
				for( x in maximums )
				{
					if( pos[x] > maximums[x] )
					{
						pos[x] = maximums[x];
						this.userData.physics.velocity[x] *= -1.0;
					}
					else if( pos[x] < -maximums[x] )
					{
						pos[x] = -maximums[x];
						this.userData.physics.velocity[x] *= -1.0;
					}
				}

				pos.multiplyScalar(1 / jumpStart.options.sceneScale);
				pos.sub(jumpStart.world.position);

				this.position.copy(pos);
			},
			"spawnBehavior": function(isInitialSync)
			{
				this.userData.physics = {
					"velocity": new THREE.Vector3(this.syncData.physics.force.x, this.syncData.physics.force.y, this.syncData.physics.force.z)
				};
			}
		},
		"lerpSync":
		{
			"syncPrep": function(options)
			{
				// The lerpSync behavior is special and always has the final word on object transform.
				// We can't wait for our applyBehavior method to be called at the end of this jumpStart.onTick
				// cycle because newly connecting users need lerpSync prepped before the tick cycle is even finished!!
				// syncPrep does all the important stuff in a way that both newly connecting users & local users can utilize.

				// This method gets called mid-tick from doPendingUpdates automatically by JumpStart if the object has a lerpSync behavior.

				if( !!!options )
					options = {};

				this.userData.lerpSync = {};
				this.userData.lerpSync.targetPosition = new THREE.Vector3();
				this.userData.lerpSync.targetQuaternion = new THREE.Quaternion();
				this.userData.lerpSync.originalPosition = new THREE.Vector3();
				this.userData.lerpSync.originalQuaternion = new THREE.Quaternion();
				this.userData.lerpSync.time = 1.0;
				this.userData.lerpSync.amount = 1.0;

				this.addEventListener("tick", jumpStart.behaviors.lerpSync.tickBehavior);
			},
			"applyBehavior": function(options)
			{
				this.syncData.lerpSync = {"speed": (!!options.speed) ? options.speed - 20 : 50.0};	// slower lerp speed to account for lag

				if( !!!this.behaviors.lerpSync )
					jumpStart.behaviors.lerpSync.syncPrep.call(this);

				return true;
			},
			"unapplyBehavior": function()
			{
				delete this.syncData["lerpSync"];
				delete this.userData["lerpSync"];
				this.removeEventListener("tick", jumpStart.behaviors.lerpSync.tickBehavior);
				return true;
			},
			"tickBehavior": function()
			{
				if( this.userData.lerpSync.amount < 1.0 )
				{
					this.userData.lerpSync.amount += jumpStart.deltaTime / this.userData.lerpSync.time;

					if( this.userData.lerpSync.amount >= 1.0 )
					{
						this.userData.lerpSync.amount = 1.0;
						this.position.copy(this.userData.lerpSync.targetPosition);
						this.quaternion.copy(this.userData.lerpSync.targetQuaternion)
					}
					else
					{
						this.position.lerpVectors(this.userData.lerpSync.originalPosition, this.userData.lerpSync.targetPosition, this.userData.lerpSync.amount);

						var currentQuaternion = this.userData.lerpSync.originalQuaternion.clone().slerp(this.userData.lerpSync.targetQuaternion, this.userData.lerpSync.amount);
						this.quaternion.copy(currentQuaternion);
					}
				}
			}
		}
	};
	this.listeners = {
		"precache": {},
		"initialize": {},	// Only used by the local user when initializing a multiuser room
		"ready": {},
		"tick": {},
		"cursordown": {},
		"cursorup": {},
		"cursormove": {},
		"keypress": {},
		"keydown": {},
		"touchpadgesture": {},
		"gamepadbutton": {}
	};

	// Attach default window-level event listeners
	if( !this.isAltspace )
		window.addEventListener( 'resize', function() { jumpStart.onWindowResize(); }, false );
	else
		altspace.addEventListener("touchpadgesture", function(e) { this.onTouchPadGesture.call(this, e); }.bind(this));

	window.addEventListener("keypress", function(e) { this.onKeyEvent.call(this, e); }.bind(this));
	window.addEventListener("keydown", function(e) { this.onKeyEvent.call(this, e); }.bind(this));

	// Merg app options with defaultOptions (up to 2 lvls deep)
	// FIX ME: Make this recursive
	if( !!options )
	{
		var x, y;
		for( x in this.options )
		{
			if( typeof this.options[x] !== "object" )
				this.options[x] = (options.hasOwnProperty(x)) ? options[x] : this.options[x];
			else if( options.hasOwnProperty(x) )
			{
				for( y in this.options[x] )
					this.options[x][y] = (options[x].hasOwnProperty(y)) ? options[x][y] : this.options[x][y];
			}
		}
	}



	// ********************************************************************************* //
	// All systems go.  Begin async tomfoolery.  Organized into sub-routines for sanity. //
	// ********************************************************************************* //

	// ASYNC 1: Load all CSS / JavaScript files sequentially
	loadHeadFiles.call(this).then(function()
	{
		// THREE & Firebase are now loaded.

		resolveEnvironment.call(this).then(function()
		{
			// Abort if app is enclosureOnly but not in an enclosure
			if( this.isAltspace && this.options.enclosureOnly && !this.isEnclosure )
			{
				// ABORT
				this.DOMReady.then(function()
				{
					this.displayInfoPanel("beamMe");

					// Must call render once for Altspace to know we want a 3D enclosure
					this.renderer = altspace.getThreeJSRenderer();
					this.renderer.render(null, null);
				}.bind(this));
			}
			else
			{
				this.precacheApp().then(function()
				{
					onDonePrecaching.call(this);
				}.bind(this));
			}

			function onDonePrecaching()
			{
				createScene.call(this);

				if( !this.options.multiuserOnly )
				{
					// If we are not multiuser, then the world hasn't been created yet.
					this.world = this.spawnInstance(null, {"parent": this.scene});
					this.world.name = "jumpStartWorld";
					//this.world.position.add(this.worldOffset);
					this.world.position.set(0, -this.enclosure.scaledHeight / 2.0, 0);

					this.onReadyToReady();
				}
				else
				{
					// Connect to firebase
					var root = "https://jumpstart-2.firebaseio.com/apps/" + this.options.appID;
					this.firebase.rootRef = new Firebase(root);
					
					// Check if this app exists
					this.firebase.rootRef.child("appData").child("createdAt").once("value", function(snapshot)
					{
						if(!snapshot.exists())
							createApp.call(this);
						else
							onAppExists.call(this);
					}.bind(this));

					function createApp()
					{
						console.warn("JumpStart: AppID \"" + this.options.appID + "\" does not exist on the server, so it will be created.");

						// FIX ME:  Add some type of app ID validity check
						this.firebase.rootRef.child("appData").update({"createdAt": Firebase.ServerValue.TIMESTAMP}, function(error)
						{
							if( error )
								console.log("JumpStart: " + error);
							else
								onAppExists.call(this);
						}.bind(this));
					}

					function onAppExists()
					{
						// Are we given a room ID?
						if( !this.roomID )
							createRoom.call(this);
						else
						{
							// Make sure this is a valid room ID AND subscribe to the state variable for future state change detection
							this.firebase.rootRef.child("rooms").child(this.roomID).child("state").on("value", onRoomStateChange.bind(this));
						}
					}

					function createRoom()
					{
						console.warn("JumpStart: No room parameter given in URL, creating new room.");
						// synchronous call with asynchronous error catching
						this.firebase.roomRef = this.firebase.rootRef.child("rooms").push({"state": "initializing", "createdAt": Firebase.ServerValue.TIMESTAMP}, function(error)
						{
							if( error )
								console.log("JumpStart: " + error);
						});

						this.roomID = this.firebase.roomRef.key();

						// Update the URL
						// FIX ME: This destroys the entire URI query.
						var pathName = document.location.pathname;
						pathName = pathName.substring(pathName.lastIndexOf("/") + 1);
						window.history.replaceState(null, document.title, pathName + "?room=" + this.firebase.roomRef.key());

						// ASYNC, continues in jumpStart.onRoomStateChange when isLocallyInitializing is TRUE && isFirstCheck
						this.firebase.isLocallyInitializing = true;
						this.firebase.rootRef.child("rooms").child(this.roomID).child("state").on("value", onRoomStateChange.bind(this));
					}

					function onRoomStateChange(snapshot)
					{
						if( !snapshot.exists() )
							console.error("JumpStart: Invalid room ID \"" + this.roomID + "\" specified.");
						else
						{
							this.firebase.state = snapshot.val();

							if( this.firebase.isLocallyInitializing )
							{
								if( this.firebase.state === "initializing" )
								{
									console.log("JumpStart: Initializing game room.");

									this.world = this.spawnInstance(null, {"parent": this.scene});
									this.world.name = "jumpStartWorld";
									this.world.position.set(0, -this.enclosure.scaledHeight / 2.0, 0);
									this.world.sync();

									// Check for initialize listeners
									var listenerName;
									for( listenerName in this.listeners.initialize )
										this.listeners.initialize[listenerName]();

									// ASYNC will continue in onRoomStateChange
									this.firebase.roomRef.update({"state": "ready"}, function(error)
									{
										if( error )
											console.log(error);
									}.bind(this));
								}
								else if( this.firebase.state === "ready" )
									onStateReady.call(this);
							}
							else
							{
								if( this.firebase.state === "ready" )
								{
									this.firebase.roomRef = this.firebase.rootRef.child("rooms").child(this.roomID);
									onStateReady.call(this);
								}
							}

							function onStateReady()
							{
								var initialKeys = {};

								// Spawn all of the initial objects
								this.firebase.roomRef.child("objects").once("value", function(parentSnapshot)
								{
									if( !parentSnapshot.exists() || parentSnapshot.numChildren() === 0 )
									{
										onInitialObjectsReady.call(this);
									}
									else
									{
										var parentData = parentSnapshot.val();

										var x;
										for( x in parentData )
										{
											initialKeys[x] = true;
											mergData.call(this, parentData[x], x);
										}

										console.log("JumpStart: Finished syncing initial state.")
										onInitialObjectsReady.call(this);
									}
								}.bind(this));

								function onInitialObjectsReady()
								{
									this.onReadyToReady();

									// Listen for objects being added
									this.firebase.roomRef.child("objects").on("child_added", function(snapshot)
									{
										var key = snapshot.key();

										// Don't doulbe-sync objects during initilization
										if( initialKeys.hasOwnProperty(key) )
										{
											delete initialKeys[key];
											return;
										}

										var data = snapshot.val();
										mergData.call(this, data, key);
									}.bind(this));
								}

								function mergData(data, key)
								{
									this.pendingUpdates[key] = {};

									var isInitialSync = initialKeys.hasOwnProperty(key);
									if( isInitialSync )
									{
										this.pendingUpdates[key].needsSpawn = true;
										this.pendingUpdates[key].isInitialSync = isInitialSync;

										this.pendingUpdates[key].transform = data.transform;
										this.pendingUpdates[key].vitalData = data.vitalData;
										this.pendingUpdates[key].syncData = data.syncData;

										if( this.isLocallyInitializing )
											return;
									}
									else if( data.vitalData.ownerID === this.localUser.userID )
									{
										if( !jumpStart.selfSyncingObject )
											this.pendingUpdates[key].needsSpawn = true;
									}
									else
										this.pendingUpdates[key].needsSpawn = true;

									// QUICK FIX FOR DOUBLE SPAWNING INITIALIZE STAGE OBJECTS:
									if( !!this.syncedObjects[key] )
										this.pendingUpdates[key].needsSpawn = false;

									console.log("JumpStart: New synced object detected!");

									// Spawn the object
									this.firebase.roomRef.child("objects").child(key).child("transform").on("value", function(snapshot)
									{
										if( initialKeys.hasOwnProperty(key) || jumpStart.selfSyncingObject )
											return;

										if( !snapshot.exists() )
										{
											// The object has been removed.
											objectRemoved.call(this, key);
											return;
										}
										
										if( !this.pendingUpdates.hasOwnProperty(key) )
											this.pendingUpdates[key] = {};

										this.pendingUpdates[key].transform = snapshot.val();
									}.bind(this));

									this.firebase.roomRef.child("objects").child(key).child("vitalData").on("value", function(snapshot)
									{
										if( initialKeys.hasOwnProperty(key) || jumpStart.selfSyncingObject )
											return;

										if( !snapshot.exists() )
										{
											// The object has been removed.
											objectRemoved.call(this, key);
											return;
										}

										if( !this.pendingUpdates.hasOwnProperty(key) )
											this.pendingUpdates[key] = {};

										this.pendingUpdates[key].vitalData = snapshot.val();
									}.bind(this));

									this.firebase.roomRef.child("objects").child(key).child("syncData").on("value", function(snapshot)
									{
										if( initialKeys.hasOwnProperty(key) || jumpStart.selfSyncingObject )
											return;

										if( !snapshot.exists() )
										{
											// The object has been removed.
											objectRemoved.call(this, key);
											return;
										}

										if( !this.pendingUpdates.hasOwnProperty(key) )
											this.pendingUpdates[key] = {};

										this.pendingUpdates[key].syncData = snapshot.val();
									}.bind(this));

									function objectRemoved(key)
									{
										var object = this.syncedObjects[key];
										if( !!!object )
											return;

										delete this.syncedObjects[key];
										this.removeInstance(object);
									}
								};
							}
						}
					}
				}
			}
/*
			function precacheApp()
			{
				return {
					"then": function(callback)
					{
						// Get stuff ready that we might use during precache
						this.objectLoader = new THREE.OBJMTLLoader();

						if( !this.isAltspace )
							onGetSkeleton.call(this, null);
						else
						{
							// Async
							altspace.getThreeJSTrackingSkeleton().then(function(skeleton)
							{
								onGetSkeleton.call(this, skeleton);
							}.bind(this));
						}

						function onGetSkeleton(skeleton)
						{
							this.localUser.skeleton = skeleton;

							// We are now initialized
							this.isInitialized = true;

							// Check for precache listeners
							var asyncRequested = false;
							var listenerName, result;
							for( listenerName in this.listeners.precache )
							{
								result = this.listeners.precache[listenerName]() || false;
								if( !result )
									asyncRequested = true;
							}

							// We are only done caching if async was NOT requested
							if( !asyncRequested )
								callback.call(this);
							else
							{
								console.warn("JumpStart: Asynchronous precaching initiated by a listener.");
								this.doneCaching = callback.bind(this);
							}
						}
					}.bind(this)
				}
			}
*/
			function createScene()
			{
				// Attach body-level event listeners for web mode
				if( !this.isAltspace && this.options.webControls )
				{
					// FIX ME: Make sure that these useCapture and preventDefaults are properly setup for web mode in these listeners
					document.body.addEventListener("contextmenu", function(e) { e.preventDefault(); return false; }, true);
					window.addEventListener( 'mousemove', this.onMouseMove.bind(this), false);
					window.addEventListener( 'mousedown', function(e) { this.onMouseDown(e); e.preventDefault(); return false; }.bind(this), false);
					window.addEventListener( 'mouseup', function(e) { this.onMouseUp(e); e.preventDefault(); return false; }.bind(this), false);
					this.addEventListener("keydown", function(keydownEvent)
					{
						switch(keydownEvent.keyCode )
						{
							case 83:
								this.camera.translateZ(20 * this.options.sceneScale);
								break;

							case 87:
								this.camera.translateZ(-20 * this.options.sceneScale);
								break;

							case 65:
								this.camera.translateX(-20 * this.options.sceneScale);
								break;

							case 68:
								this.camera.translateX(20 * this.options.sceneScale);
								break;
						}
					}.bind(this), true);
				}

				// Convert the camera position from a generic object to a THREE.Vector3 (now that THREE.js is loaded.)
				this.options.camera.position = new THREE.Vector3(this.options.camera.position.x, this.options.camera.position.y, this.options.camera.position.z);

				// Create an invisible material
				this.invisibleMaterial = new THREE.MeshBasicMaterial( { color: "#ffffff", transparent: true, opacity: 0.5, visible: false});

				this.worldOffset = new THREE.Vector3(0.0, -this.enclosure.scaledHeight / 2.0, 0.0);

				this.scene = new THREE.Scene();
				this.scene.scale.multiplyScalar(this.options.sceneScale);
				this.scene.addEventListener( "cursormove", this.onCursorMove.bind(this));
				this.scene.addEventListener("cursordown", this.onCursorDown.bind(this));
				this.scene.addEventListener("cursorup", this.onCursorUp.bind(this));

				this.clock = new THREE.Clock();
				this.raycaster = new THREE.Raycaster();

				// FIX ME: Why is this a spoofed ray?  We should have THREE.js loaded by now to make a real one.
				this.cursorRay = {"origin": new THREE.Vector3(), "direction": new THREE.Vector3()};
				this.futureCursorRay = {"origin": new THREE.Vector3(), "direction": new THREE.Vector3()};

				if ( !this.isAltspace )
				{
					this.renderer = new THREE.WebGLRenderer({ alpha: true });
					this.renderer.setClearColor( 0x00ff00, 0.3 );
					this.renderer.setSize( window.innerWidth, window.innerHeight );

					this.DOMReady().then(function() { document.body.appendChild( this.renderer.domElement ); }.bind(this));

					var aspect = window.innerWidth / window.innerHeight;
					this.camera = new THREE.PerspectiveCamera(45, aspect, 1, 4000 * this.options.sceneScale );

					var pos = this.options.camera.position.clone().add(this.worldOffset.clone().multiplyScalar(this.options.sceneScale));
					this.camera.position.copy(pos);

					var lookAtSpot = this.worldOffset.clone().multiplyScalar(this.options.sceneScale);
					lookAtSpot.y += 50;

					this.camera.lookAt(lookAtSpot);

					this.localUser.cursorRayOrigin.copy(this.camera.position);

					// OBJMTLLoader always uses PhongMaterial, so we need light in scene.
					var ambient = new THREE.AmbientLight( 0xffffff );
					this.scene.add( ambient );
				}
				else
					this.renderer = altspace.getThreeJSRenderer();
			}
		}.bind(this));
	}.bind(this));

	function loadHeadFiles()
	{
		// Async
		return {
				"then": function(loadHeadFilesCallback)
				{
					// Define the list of CSS files
					var baseStyles = ["engine/misc/JumpStartStyle.css"];

					// Load all the CSS files
					this.loadStylesheets(baseStyles).then(function()
					{
						console.log("JumpStart: Loaded " + baseStyles.length + " stylesheet(s).");

						// Define the list of JavaScript files
						var baseScripts = [
							"https://cdn.firebase.com/js/client/2.3.2/firebase.js",
							"http://sdk.altvr.com/libs/three.js/r73/build/three.min.js",
							"http://sdk.altvr.com/libs/three.js/r73/examples/js/loaders/OBJMTLLoader.js",
							"http://sdk.altvr.com/libs/three.js/r73/examples/js/loaders/MTLLoader.js",
							"http://sdk.altvr.com/libs/altspace.js/0.5.3/altspace.min.js"
							//"engine/misc/threeoctree.js"	// Octree disabled for now
						];

						// Load all the JavaScript files
						this.loadJavaScripts(baseScripts).then(function(result)
							{
								console.log("JumpStart: Loaded " + baseScripts.length + " JavaScript(s).");
								loadHeadFilesCallback();
							}.bind(this));
					}.bind(this));
				}.bind(this)
			};
	}

	function resolveEnvironment()
	{
		// Async
		return {
				"then": function(resolveEnvironmentCallback)
				{
					// Either get the enclosure or spoof it then call onGetEnclosure
					if( !this.isAltspace )
					{
						// Spoof the enclosure for web mode
						var commonVal = Math.round(1024 / 2.5);	// FIX ME: Why this magic number?
						var pixelsPerMeter = 50.0;	// FIX ME: Why this magic number?

						if( !this.options["scaleWithEnclosure"] )
							this.options.sceneScale *= pixelsPerMeter / 100.0;	// FIX ME: Why this magic number?

						var enclosure = {
							"innerWidth": commonVal,
							"innerHeight": commonVal,
							"innerDepth": commonVal,
							"scaledWidth": Math.round(commonVal * (1 / this.options.sceneScale)),
							"scaledHeight": Math.round(commonVal * (1 / this.options.sceneScale)),
							"scaledDepth": Math.round(commonVal * (1 / this.options.sceneScale)),
							"pixelsPerMeter": pixelsPerMeter
						};

						// FIX ME: Web mouse should be put into its own calss.
						this.webMouse = {"x": commonVal / 2.0, "y": commonVal / 2.0};

						onGetEnclosure.call(this, enclosure);
					}
					else
					{
						// Async
						altspace.getEnclosure().then(function(enclosure)
						{
							if( !this.options["scaleWithEnclosure"] )
								this.options.sceneScale *= enclosure.pixelsPerMeter / 100.0;	// FIX ME: Why this magic number?

							// FIX ME: These are only needed in specific cases.
							enclosure.adjustedWidth = Math.round(enclosure.innerWidth * this.options.sceneScale);
							enclosure.adjustedHeight = Math.round(enclosure.innerHeight * this.options.sceneScale);
							enclosure.adjustedDepth = Math.round(enclosure.innerDepth * this.options.sceneScale);

							enclosure.scaledWidth = enclosure.innerWidth * (1 / this.options.sceneScale);
							enclosure.scaledHeight = enclosure.innerHeight * (1 / this.options.sceneScale);
							enclosure.scaledDepth = enclosure.innerDepth * (1 / this.options.sceneScale);

							onGetEnclosure.call(this, enclosure);
						}.bind(this));
					}

					function onGetEnclosure(enclosure)
					{
						this.enclosure = enclosure;
						this.isEnclosure = (this.isAltspace && Math.abs(this.enclosure.pixelsPerMeter - 521) > 1) ? true : false;

						// Either get the user or spoof it then call onGetUser
						if( !this.isAltspace )
						{
							// Spoof the user for web mode
							var user = {
								"userId": "WebUser" + Date.now(),
								"isLocal": true,
								"displayName": "WebUser"
							};

							onGetUser.call(this, user);
						}
						else
						{
							// Async
							altspace.getUser().then(function(user)
							{
								onGetUser.call(this, user);
							}.bind(this));
						}

						function onGetUser(user)
						{
							user.cursorRayOrigin = new THREE.Vector3();
							user.cursorRayDirection = new THREE.Vector3();
							user.cursorHit = null;
							user.userID = user.userId;

							this.localUser = user;
							resolveEnvironmentCallback();
						}
					}
				}.bind(this)
		}
	}
}

JumpStart.prototype.onKeyEvent = function(e)
{
	if( !this.pendingEvents.hasOwnProperty(e.type) )
		this.pendingEvents[e.type] = {};

	var code = (e.type === "keypress") ? e.charCode : e.keyCode;
	this.pendingEvents[e.type][code] = e;
};

JumpStart.prototype.onTouchPadGesture = function(e)
{
	if( !this.pendingEvents.hasOwnProperty("touchpadgesture") )
		this.pendingEvents["touchpadgesture"] = {};

	var code = e.gesture;
	this.pendingEvents["touchpadgesture"][code] = e;
};

JumpStart.prototype.precacheApp = function()
{
	return {
		"then": function(callback)
		{
			// Get stuff ready that we might use during precache
			this.objectLoader = new THREE.OBJMTLLoader();

			if( !this.isAltspace )
				onGetSkeleton.call(this, null);
			else
			{
				// Async
				altspace.getThreeJSTrackingSkeleton().then(function(skeleton)
				{
					onGetSkeleton.call(this, skeleton);
				}.bind(this));
			}

			function onGetSkeleton(skeleton)
			{
				this.localUser.skeleton = skeleton;

				// We are now initialized
				this.isInitialized = true;

				// Check for precache listeners
				var asyncRequested = false;
				var listenerName, result;
				for( listenerName in this.listeners.precache )
				{
					result = this.listeners.precache[listenerName]() || false;
					if( !result )
						asyncRequested = true;
				}

				// We are only done caching if async was NOT requested
				if( !asyncRequested )
					callback.call(this);
				else
				{
					console.warn("JumpStart: Asynchronous precaching initiated by a listener.");
					this.doneCaching = callback.bind(this);
				}
			}
		}.bind(this)
	}
}

JumpStart.prototype.onReadyToPrecache = function()
{
	return {
		"then": function(callback)
		{
			// Get stuff ready that we might use during precache
			this.objectLoader = new THREE.OBJMTLLoader();

			if( !this.isAltspace )
				onGetSkeleton.call(this, null);
			else
			{
				// Async
				altspace.getThreeJSTrackingSkeleton().then(function(skeleton)
				{
					onGetSkeleton.call(this, skeleton);
				}.bind(this));
			}

			function onGetSkeleton(skeleton)
			{
				this.localUser.skeleton = skeleton;

				// We are now initialized
				this.isInitialized = true;

				// Check for precache listeners
				var asyncRequested = false;
				var listenerName, result;
				for( listenerName in this.listeners.precache )
				{
					result = this.listeners.precache[listenerName]() || false;
					if( !result )
						asyncRequested = true;
				}

				// We are only done caching if async was NOT requested
				if( !asyncRequested )
					this.doneCaching();
				else
					console.warn("JumpStart: Asynchronous precaching initiated by a listener.");
			}
		}.bind(this)
	};
};

JumpStart.prototype.spawnCursorPlane = function(options)
{
	var defaultOptions = {
		"width": this.enclosure.scaledWidth,
		"height": this.enclosure.scaledHeight,
		"parent": this.world
	};

	// Merg options with defaultOptions
	if( !!options )
	{
		var x;
		for( x in defaultOptions )
			options[x] = (!!options[x]) ? options[x] : defaultOptions[x];
	}
	else
		options = defaultOptions;

	// Now create the hit plane
	// color generator from:
	// http://stackoverflow.com/questions/1484506/random-color-generator-in-javascript
	function getRandomColor() {
		var letters = '0123456789abcdef'.split('');
		var color = '#';
		for (var i = 0; i < 6; i++ ) {
			color += letters[Math.floor(Math.random() * 16)];
		}

		return color;
	}

	var cursorPlane = new THREE.Mesh(
		new THREE.BoxGeometry(options.width, options.height, 0),
		new THREE.MeshBasicMaterial( { color: getRandomColor(), transparent: true, opacity: 0.5, visible: this.options.debug["showCursorPlanes"] })
	);

	this.spawnInstance(null, {"object": cursorPlane, "parent": options.parent});
	return cursorPlane;
};

JumpStart.prototype.onCursorMove = function(e)
{
	if( e.hasOwnProperty("ray") )
		this.futureCursorRay = e.ray;
	else
		this.futureCursorRay = e.cursorRay;	// Only needed until 0.1 is completely depreciated
};

JumpStart.prototype.precacheSound = function(fileName)
{
	if( !!this.sounds[fileName] )
		return;

	longFileName = "assets/" + this.options.appID + "/" + fileName + ".ogg";

	var req = new XMLHttpRequest();
	req.open("GET", longFileName);
	req.responseType = "arraybuffer";
	req.onload = function()
	{
		this.audioContext.decodeAudioData(req.response, function(buffer)
		{
			this.sounds[fileName] = buffer;
		}.bind(this));
	}.bind(this);
	req.send();
};

JumpStart.prototype.playSound = function(fileName, volumeScale, loop)
{
	if( !!!this.sounds[fileName] )
	{
		console.warn("JumpStart: The sound " + fileName + " is not yet cached!");
		this.precacheSound(fileName);
		return;
	}

	var volumeScale = (!!volumeScale) ? volumeScale : 1.0;

	var sound = this.sounds[fileName];
	var source = this.audioContext.createBufferSource();
	source.buffer = sound;
	source.loop = !!loop;

	var gainNode = this.audioContext.createGain();
	gainNode.gain.value = 1.0 * volumeScale;
	source.connect(gainNode);
	gainNode.connect(this.audioContext.destination);

	source.start(0);

	return {source: source, gainNode: gainNode};
};

JumpStart.prototype.onReadyToReady = function()
{
	this.isReady = true;

	// This will spawn the world, but nothing else.
	this.doPendingUpdates();

	// Check for ready listeners
	var asyncRequested = false;
	var listenerName, result;
	for( listenerName in this.listeners.ready )
	{
		result = this.listeners.ready[listenerName]() || false;
		if( !result )
			asyncRequested = true;
	}

	// We are only done caching if async was NOT requested
	if( !asyncRequested )
		this.run();
	else
		console.warn("JumpStart: Asynchronous ready-idle initiated by a listener.");
};

JumpStart.prototype.run = function()
{
	this.isRunning = true;

	this.onTick();
	console.log("JumpStart: Simulation started.");
};

JumpStart.prototype.extractData = function(data, targetData, maxDepth, currentDepth)
{
	if( arguments.length < 3 )
		maxDepth = Infinity;

	if( arguments.length < 4 )
		currentDepth = 0;

	var x, childData, childDataType, listenerName, funcName, handler, dotIndex, behaviorName, eventName, behaviorHandler;
	for( x in data)
	{
		if( x === "listeners" )
		{
			for( listenerName in data[x] )
			{
				for( funcName in data[x][listenerName] )
				{
					handler = window[funcName];

					if( !!!handler )
					{
						dotIndex = funcName.indexOf("-");
						if( dotIndex > 0 )
						{
							behaviorName = funcName.substring(0, dotIndex);
							eventName = funcName.substring(dotIndex + 1);

							if( !!this.behaviors[behaviorName] )
							{
								behaviorHandler = this.behaviors[behaviorName][eventName];
								if( !!behaviorHandler )
									handler = behaviorHandler;
							}
						}
					}

					targetData.listeners[listenerName][funcName] = handler;
				}
			}
		}
		else
		{
			childData = data[x];
			childDataType = typeof childData;

			if( childDataType === "object" && currentDepth < maxDepth )
			{
				if( !!!targetData[x] )
					targetData[x] = {};

				this.extractData.call(this, childData, targetData[x], maxDepth, currentDepth+1);
			}
			else if( childDataType === "number" || childDataType === "string" || childDataType === "boolean" )
				targetData[x] = childData;
		}
	}
};

JumpStart.prototype.doPendingUpdates = function()
{
	// Handle pending object updates
	var x, y, data, instance;
	for( x in this.pendingUpdates )
	{
		data = this.pendingUpdates[x];

		if( !!data.needsSpawn )
			instance = this.spawnInstance(null, {"networkData": data, "syncKey": x, "isInitialSync": !!data.isInitialSync});
		else
		{
			instance = this.syncedObjects[x];

			if( !instance )
			{
				delete this.pendingUpdates[x];
				continue;
			}

			var x;
			// Handle changed behaviors BEFORE merging in the rest of the networked data
			if( !!data.vitalData && !!data.vitalData.behaviors )
			{
				for( x in data.vitalData.behaviors )
				{
					if( !!!instance.behaviors || !!!instance.behaviors[x] )
						instance.applyBehavior(x);
				}
			}

			if( !!instance.behaviors )
			{
				for( x in instance.behaviors )
				{
					if( !!data.vitalData && (!!!data.vitalData.behaviors || !!!data.vitalData.behaviors[x]) )
						instance.unapplyBehavior(x);
				}
			}
		}

		var deferredTransform = false;
		if( data.hasOwnProperty("transform") )
		{
			instance.name = data.transform.name;

			// There is only ONE case where transform updates would not be applied:
			// Check if lerpSync behavior exists on this instance or in the data
			if(
				(!!data.vitalData && !!data.vitalData.behaviors && !!data.vitalData.behaviors.lerpSync) ||
				(!!instance.behaviors.lerpSync && (!!!data.vitalData || !!data.vitalData.behaviors.lerpSync))
			 )
				deferredTransform = true;
			else
			{
				instance.position.set(data.transform.position.x, data.transform.position.y, data.transform.position.z);
				instance.quaternion.set(data.transform.quaternion._x, data.transform.quaternion._y, data.transform.quaternion._z, data.transform.quaternion._w);
				instance.scale.set(data.transform.scale.x, data.transform.scale.y, data.transform.scale.z);
			}
		}

		if( data.hasOwnProperty("vitalData") )
			this.extractData.call(this, data.vitalData, instance, Infinity);

		if( data.hasOwnProperty("syncData") )
			this.extractData.call(this, data.syncData, instance.syncData, Infinity);

		// Deferred transforms means a lerpSync behavior applied to this object
		if( deferredTransform && !!instance.behaviors.lerpSync )
		{
			// pre-prep this instance for lerpSync if this is its 1st sync received
			if( !!!instance.userData.lerpSync )
				jumpStart.behaviors.lerpSync.syncPrep.call(instance);

			if( !!!data.isInitialSync )
			{
				instance.userData.lerpSync.targetPosition.set(data.transform.position.x, data.transform.position.y, data.transform.position.z);
				instance.userData.lerpSync.targetQuaternion.set(data.transform.quaternion._x, data.transform.quaternion._y, data.transform.quaternion._z, data.transform.quaternion._w);

				var distance = instance.position.distanceTo(instance.userData.lerpSync.targetPosition);
				var autoSpeed = instance.syncData.lerpSync.speed + (0.9 * distance);
				instance.userData.lerpSync.time = distance / autoSpeed;
				instance.userData.lerpSync.amount = 0.0;
				instance.userData.lerpSync.originalPosition.copy(instance.position);
				instance.userData.lerpSync.originalQuaternion.copy(instance.quaternion);

				// FIX ME: Only position is being lerped so far, but the qauternion and scale need to be lerped too.
//				instance.quaternion.set(data.transform.quaternion._x, data.transform.quaternion._y, data.transform.quaternion._z, data.transform.quaternion._w);
				instance.scale.set(data.transform.scale.x, data.transform.scale.y, data.transform.scale.z);
			}
			else
			{
				// If this is the initial sysnc, just copy the transform in immediately
				instance.position.set(data.transform.position.x, data.transform.position.y, data.transform.position.z);
				instance.quaternion.set(data.transform.quaternion._x, data.transform.quaternion._y, data.transform.quaternion._z, data.transform.quaternion._w);
				instance.scale.set(data.transform.scale.x, data.transform.scale.y, data.transform.scale.z);
			}
		}

		delete this.pendingUpdates[x];
	}
};

JumpStart.prototype.onGamepadButtonEvent = function(e)
{
	if( !this.pendingEvents.hasOwnProperty(e.type) )
		this.pendingEvents[e.type] = {};

	this.pendingEvents[e.type][e.buttonCode] = e;
};

JumpStart.prototype.onTick = function()
{
	if( !this.isInitialized )
		return;

	// do gamepad input
	if( this.isAltspace )
		this.gamepads = altspace.getGamepads();
	else
		this.gamepads = (!!navigator.getGamepads) ? navigator.getGamepads() : this.gamepads = navigator.webkitGetGamepads();
	
	// Detect a gamepad
	if( this.activeGamepadIndex === -1 )
	{
		var gamepadIndex, gamepad, previousGamepadState, buttonIndex;
		for( gamepadIndex in this.gamepads )
		{
			gamepad = this.gamepads[gamepadIndex];

			if( typeof this.previousGamepadStates[gamepadIndex] === "undefined" )
				this.previousGamepadStates[gamepadIndex] = {"buttons": []};

			previousGamepadState = this.previousGamepadStates[gamepadIndex];

			if( !!gamepad && !!gamepad.buttons && gamepad.buttons.length > 0 )
			{
				for( buttonIndex in gamepad.buttons )
				{
					if( typeof previousGamepadState.buttons[buttonIndex] === "undefined" )
					{
						previousGamepadState.buttons[buttonIndex] = {};
					}
					else if( previousGamepadState.buttons[buttonIndex].value !== gamepad.buttons[buttonIndex].value )
					{
						if( this.activeGamepadIndex === -1 )
							this.activeGamepadIndex = gamepadIndex;
					}

					previousGamepadState.buttons[buttonIndex].value = gamepad.buttons[buttonIndex].value;
				}
			}
		}
	}

	if( this.activeGamepadIndex !== -1 )
	{
		// Poll the active gamepad
		var gamepad = this.gamepads[this.activeGamepadIndex];
		var previousGamepadState = this.previousGamepadStates[this.activeGamepadIndex];

		if( !!gamepad.buttons && gamepad.buttons.length > 0 )
		{
			var buttonIndex;
			for( buttonIndex in gamepad.buttons )
			{
				if( gamepad.buttons[buttonIndex].value !== previousGamepadState.buttons[buttonIndex].value )
				{
					// Button value has changed
					var fakeEvent = {
						"type": "gamepadbutton",
						"buttonCode": parseInt(buttonIndex),
						"value": gamepad.buttons[buttonIndex].value
					};

					this.onGamepadButtonEvent(fakeEvent);
					previousGamepadState.buttons[buttonIndex].value = gamepad.buttons[buttonIndex].value;
				}
			}
		}
	}

	function doPendingListeners()
	{
		// Do some more event listeners
		var x, y, z, eventCategory;
		for( x in this.pendingEvents )
		{
			eventCategory = this.pendingEvents[x];
			for( y in eventCategory )
			{
				for( z in this.listeners[x] )
					this.listeners[x][z].call(this, eventCategory[y]);
			}

			this.pendingEvents[x] = {};
		}
	};

	this.doPendingUpdates();
	doPendingListeners.call(this);

	var i, freshObject, listenerName, isInitialSync;
	for( i in this.freshObjects )
	{
		freshObject = this.freshObjects[i];

		isInitialSync = (!!freshObject.__isInitialSync) ? freshObject.__isInitialSync : false;
		delete freshObject["__isInitialSync"];

		for( listenerName in freshObject.listeners.spawn )
			freshObject.listeners.spawn[listenerName].call(freshObject, isInitialSync);
	}
	this.freshObjects.length = 0;

	var count = 0;
	var y;
	for( x in this.objects )
	{
		object = this.objects[x];
		if( false && object.parent !== this.scene )
		{
			// FIX ME: Delete this property from the object.
			console.error("JumpStart: It's gone!! The object was removed from the scene before it should have been!");
		}
		else
		{
			// Apply any object.visible settings since last tick
			if( object.spoofVisible !== object.visible )
			{
				object.spoofVisible = object.visible;

				if( object.visible )
					this.makeMaterialsVisible(object);
				else
					this.makeMaterialsInvisible(object);
			}

			// Determine if this will be raycasted against this tick
			if( object.blocksLOS )
			{
				this.raycastArray[count] = object;
				count++;
			}

			// Check for tick listeners on the object
			for( y in object.listeners.tick )
			{
				if( !!!object.listeners.tick[y] )
					continue;
				
				object.listeners.tick[y].call(object);
			}
		}
	}

	this.raycastArray.length = count;

	// Check for spawn listeners on fresh objects
	/*
	var i, freshObject, listenerName, isInitialSync;
	for( i in this.freshObjects )
	{
		freshObject = this.freshObjects[i];

		isInitialSync = (!!freshObject.__isInitialSync) ? freshObject.__isInitialSync : false;
		delete freshObject["__isInitialSync"];

		for( listenerName in freshObject.listeners.spawn )
			freshObject.listeners.spawn[listenerName].call(freshObject, isInitialSync);
	}
	*/
	//this.freshObjects.length = 0;

	// Check for tick listeners
	var listenerName;
	for( listenerName in this.listeners.tick )
		this.listeners.tick[listenerName]();

	requestAnimationFrame( function(){ jumpStart.onTick(); } );
	this.renderer.render( this.scene, this.camera );

	this.elapsedTime = this.clock.elapsedTime;
	this.deltaTime = this.clock.getDelta();
	this.deltaTime *= this.options.timeScale;

	this.processCursorMove();
};

JumpStart.prototype.makeMaterialsInvisible = function(object)
{
	object.traverse(function(child)
	{
		if( child.material && child.material instanceof THREE.MeshPhongMaterial )
			child.material.visible = false;
	}.bind(this));
};

JumpStart.prototype.applyInvisibleMaterial = function(object)
{
	var model = this.findModel(object.modelFile);
	
	model.object.traverse(function(child)
	{
		if( child.material && child.material instanceof THREE.MeshPhongMaterial )
			child.material = this.invisibleMaterial;
	}.bind(this));
};

JumpStart.prototype.makeMaterialsVisible = function(object)
{
	object.traverse(function(child)
	{
		if( child.material && child.material instanceof THREE.MeshPhongMaterial )
		{
			child.material.visible = true;
		}
	}.bind(this));
};

JumpStart.prototype.onMouseMove = function(e)
{
	if( this.isAltspace || !this.isRunning )
		return;

	// Fill with 2D position for now
	var mouse3D = new THREE.Vector3(0, 0, 0);
	mouse3D.x = (e.clientX / window.innerWidth) * 2 - 1;
	mouse3D.y = -(e.clientY / window.innerHeight) * 2 + 1;
	mouse3D.z = 0.5;

	this.webMouse.x = mouse3D.x;
	this.webMouse.y = mouse3D.y;

	// Convert the 2D position to a 3D point
	mouse3D.unproject(this.camera);

	// Get a look vector from the camera to mouse3D
	var direction = new THREE.Vector3();
	direction = mouse3D.sub(this.camera.position).normalize();

	this.futureCursorRay.origin = this.camera.position;
	this.futureCursorRay.direction = direction;
};

JumpStart.prototype.onMouseDown = function(e)
{
	if( !this.isRunning )
		return;

	switch( e.button )
	{
		case 0:
			this.onCursorDown();
			break;

		case 2:
			var pos = this.localUser.cursorRayOrigin.clone().multiplyScalar(this.options.sceneScale).add(this.localUser.cursorRayDirection);
			this.camera.lookAt(pos);
			break;
	}
};

JumpStart.prototype.onMouseUp = function(e)
{
	if( !this.isRunning )
		return;

	switch( e.button )
	{
		case 0:
			this.onCursorUp();
			break;

		case 2:
			break;
	}
};

JumpStart.prototype.processCursorMove = function()
{
	if( !this.isRunning )
		return;

	this.cursorRay = this.futureCursorRay;

	// Update the local user's look info
	this.localUser.cursorRayOrigin.copy(this.cursorRay.origin);
	this.localUser.cursorRayOrigin.multiplyScalar(1.0 / this.options.sceneScale);
	this.localUser.cursorRayDirection.copy(this.cursorRay.direction);

	// Set the raycaster
	this.raycaster.set(this.cursorRay.origin, this.cursorRay.direction);

	// Octree disabled for now
	/* http://threejs.org/examples/#webgl_octree_raycasting
	var octreeObjects = this.octree.search( this.cursorRay.origin, 200000, true, this.cursorRay.direction );
	var intersections = this.raycaster.intersectOctreeObjects( octreeObjects );
	if( intersections.length )
	{
		console.log("yar");
	}
	*/

	// FIX ME: Might want to raycast against collision boxes of all objects, then another raycast against the faces of intersected objects.
/*
	this.raycastArray.sort(function(a, b)
	{
		var worldPosA = new THREE.Vector3().setFromMatrixPosition(a.matrixWorld);
		var worldPosB = this.localUser.cursorRayOrigin;//this.cursorRay.origin;//new THREE.Vector3().setFromMatrixPosition(b.matrixWorld);
		return worldPosA.distanceTo(worldPosB) * -1.0;
	}.bind(this));

	var i, object, intersection;
	for( i in this.raycastArray )
	{
		intersection = this.raycaster.intersectObject(this.raycastArray[i], true);

		if( intersection.length === 0 )
			continue;
		else
			intersection = intersection[0];

		object = intersection.object;
		while( !object.hasOwnProperty("blocksLOS") )
			object = object.parent;

		// If there already is a hovered object, unhover it.
		if( this.hoveredObject && this.hoveredObject !== object )
			unhover.call(this, this.hoveredObject);

		if( !this.hoveredObject )
		{
			this.hoveredObject = object;

			// Check for cursorenter listeners
			// FIX ME: Add support for event bubbling
			var listenerName;
			for( listenerName in object.listeners.cursorenter )
				object.listeners.cursorenter[listenerName].call(object);
		}

		this.localUser.cursorHit = intersection;
		this.localUser.cursorHit.scaledPoint = intersection.point.clone().multiplyScalar(1 / this.options.sceneScale).sub(this.world.position);

		this.localUser.cursorHit.mesh = intersection.object;
		this.localUser.cursorHit.object = object;

		hasIntersection = true;
		break;
	}
*/
	var intersects = this.raycaster.intersectObjects(this.raycastArray, true);	// FIX ME: Wish there was a way to quit after 1st "hit".

	// Hover events
	var hasIntersection = false;
	var x, object;
	for( x in intersects )
	{
		intersection = intersects[x];

		object = intersection.object;
		while( !object.hasOwnProperty("blocksLOS") )
			object = object.parent;

		// If there already is a hovered object, unhover it.
		if( this.hoveredObject && this.hoveredObject !== object )
			unhover.call(this, this.hoveredObject);

		if( !this.hoveredObject )
		{
			this.hoveredObject = object;

			// Check for cursorenter listeners
			// FIX ME: Add support for event bubbling
			var listenerName;
			for( listenerName in object.listeners.cursorenter )
				object.listeners.cursorenter[listenerName].call(object);
		}

		this.localUser.cursorHit = intersection;
		this.localUser.cursorHit.scaledPoint = intersection.point.clone().multiplyScalar(1 / this.options.sceneScale).sub(this.world.position);

		this.localUser.cursorHit.mesh = intersection.object;
		this.localUser.cursorHit.object = object;

		hasIntersection = true;
		break;
	}

	if( !hasIntersection )
		this.localUser.cursorHit = null;

	// If nothing is hovered, then unhover us
	if( this.hoveredObject && !hasIntersection )
		unhover.call(this, this.hoveredObject);

	function unhover(object)
	{
		var oldObject = this.hoveredObject;
		this.hoveredObject = null;

		// Check for cursorexit listeners
		// FIX ME: Add support for event bubbling
		var listenerName;
		for( listenerName in oldObject.listeners.cursorexit )
			oldObject.listeners.cursorexit[listenerName].call(oldObject);
	}
};

JumpStart.prototype.isWorldPosInsideOfEnclosure = function(worldPos)
{
	var x;
	for( x in worldPos )
	{
		if( worldPos[x] + this.world.position[x] > this.enclosure.scaledWidth/2.0 || worldPos[x] + this.world.position[x] < -this.enclosure.scaledWidth/2.0 )
			return false;
	}

	return true;
};

JumpStart.prototype.onCursorDown = function(e)
{
	if( this.hoveredObject )
	{
		// Check for cursordown listeners
		var listenerName;
		for( listenerName in this.hoveredObject.listeners.cursordown )
			this.hoveredObject.listeners.cursordown[listenerName].call(this.hoveredObject);

		this.clickedObject = this.hoveredObject;
	}
};

JumpStart.prototype.onCursorUp = function(e)
{
	if( this.clickedObject )
	{
		// Check for cursorup listeners
		var listenerName;
		for( listenerName in this.clickedObject.listeners.cursorup )
			this.clickedObject.listeners.cursorup[listenerName].call(this.clickedObject);

		this.clickedObject = null;
	}
};

JumpStart.prototype.onWindowResize = function()
{
	if( jumpStart.isAltspace )
		return;

	jumpStart.camera.aspect = window.innerWidth / window.innerHeight;
	jumpStart.camera.updateProjectionMatrix();
	jumpStart.renderer.setSize(window.innerWidth, window.innerHeight);
};

JumpStart.prototype.loadModels = function(fileNames)
{
	// fileNames are relative to the "assets/[appID]/" path.
	// Convert all fileNames to valid paths.

	var i;
	for( i in fileNames )
	{
		fileNames[i] = "assets/" + this.options.appID + "/" + fileNames[i];
	}

	// Return a promise-like structure
	// FIX ME: Logic only executes if the caller requests the "then" function. Same with all async "then"-syntax returns in JumpStart.
	return {
			"then": function(callback)
			{
				promiseCallback = callback;

				var found = fileNames[0].lastIndexOf("/");
				//var urlTrunk = (found > 0) ? fileNames[0].substring(0, found) : "";
				var urlFile = (found > 0 ) ? fileNames[0].substring(found+1) : fileNames[0];

				found = location.pathname.lastIndexOf("/");
				var urlPath = (found > 0) ? location.pathname.substring(1, found) : "";

				var multiloader = altspace.utilities.multiloader;
				multiloader.init({
					crossOrigin: "anonymous",
					baseUrl: ""
				});

				var loadRequest = new multiloader.LoadRequest();
				var i, fileName;
				for( i = 0; i < fileNames.length; i++ )
				{
					fileName = fileNames[i];
					loadRequest.objUrls.push(urlPath + "/" + fileName + ".obj");
					loadRequest.mtlUrls.push(urlPath + "/" + fileName + ".mtl");
				}

				multiloader.load(loadRequest, function()
				{
					var i, object, fileName;
					for( i = 0; i < loadRequest.objects.length; i++ )
					{
						object = loadRequest.objects[i];

						fileName = loadRequest.objUrls[i];
						if( urlPath !== "" )
							fileName = fileName.substring(urlPath.length + 1);

						fileName = fileName.substring(0, fileName.length - 4);

						this.models.push({
							"modelFile": fileName,
							"object": object
						});
					}

					console.log("JumpStart: Loaded " + loadRequest.objectsLoaded + " model(s).");
					promiseCallback(fileNames.length);
				}.bind(this));
			}.bind(this)
		};
};

// PURPOSE:
//	- Private method for checking if a model is already cached.
JumpStart.prototype.findModel = function(modelFile)
{
	modelFile = "assets/" + this.options.appID + "/" + modelFile;
	
	var i, model;
	for( i = 0; i < this.models.length; i++ )
	{
		model = this.models[i];
		if( model.modelFile === modelFile )
			return model;
	}
};

JumpStart.prototype.removeInstance = function(instance)
{
	if( !instance || !this.objects.hasOwnProperty(instance.uuid) )
		return;

	var uuid = instance.uuid;
	object = this.objects[uuid];	// FIX ME: Don't search through the objects array twice! Combine this with the if statement above.

	// Unhover this object, but ignore listeners
	if( this.hoveredObject === object )
		this.hoveredObject = null;

	// Unclick this object, but ignore listeners
	if( this.clickedObject === object )
		this.clickedObject = null;

	// Now remove this object
	for( listenerName in object.listeners.remove )
		object.listeners.remove[listenerName].call(object);

	object.parent.remove(object);

	if( object.syncKey && this.syncedObjects.hasOwnProperty(object.syncKey))
	{
		// Remove us from immediately from our local synced objects list
		delete this.syncedObjects[object.syncKey];

		// Remove us from the firebase
		this.firebase.roomRef.child("objects").child(object.syncKey).remove();
	}

	delete this.objects[uuid];

	//console.log("JumpStart: Removed an object.");
};

JumpStart.prototype.enclosureBoundary = function(boundaryID)
{
	var boundary;

	if( !!this.enclosureBoundaries.boundaryID )
		boundary = this.enclosureBoundaries.boundaryID;
	else
	{
		boundary = this.spawnCursorPlane({"parent": jumpStart.scene});
		boundary.blocksLOS = true;

		boundary.userData.isBoundaryPlane = true;

		switch( boundaryID )
		{
			case "floor":
				boundary.rotateX(Math.PI / 2.0);
				boundary.position.copy(this.worldOffset);
				break;

			case "ceiling":
				boundary.rotateX(Math.PI / 2.0);
				boundary.position.set(0, -this.worldOffset.y, 0);
				break;

			case "north":
				boundary.position.set(0, 0, -this.worldOffset.y);
				break;

			case "south":
				boundary.position.set(0, 0, this.worldOffset.y);
				break;

			case "west":
				boundary.rotateY(Math.PI / 2.0);
				boundary.position.set(this.worldOffset.y, 0, 0);
				break;

			case "east":
				boundary.rotateY(Math.PI / 2.0);
				boundary.position.set(-this.worldOffset.y, 0, 0);
				break;
		}

		this.enclosureBoundaries[boundaryID] = boundary;
	}

	return boundary;
};

JumpStart.prototype.spawnInstance = function(modelFile, options)
{
	var defaultOptions = {
		"object": null,
		"parent": this.world,
		"networkData": null,
		"syncKey": null,
		"isInitialSync": false
	};

	// Merg options with defaultOptions
	if( !!options )
	{
		var x;
		for( x in defaultOptions )
			options[x] = (!!options[x]) ? options[x] : defaultOptions[x];
	}
	else
		options = defaultOptions;

	if( !!!modelFile )
		modelFile = (options.networkData && !!options.networkData.vitalData) ? options.networkData.vitalData.modelFile : "";

	var instance;
	if( options.object )
		instance = options.object;
	else if( modelFile !== "" )
	{
		var existingModel = this.findModel(modelFile);

		if( !existingModel )
		{
			console.error("JumpStart: The model " + modelFile + " is not yet cached.");
			return;
		}
		else
			instance = existingModel.object.clone();
	}
	else
		instance = new THREE.Group();

	//instance.position.set(0, this.worldOffset.y, 0);

	/* OCTREE DISABLED FOR NOW
	// FIXME: Objects should only be added to the octree when they are blocksLOS = true
	var i, mesh;
	for( i in instance.children )
	{
		mesh = instance.children[i];

		if( mesh.geometry.faces.length > 0 )
			this.octree.add( mesh, { "useFaces": true } );
	}
	*/
	
	if( !!options.networkData && options.networkData.transform.name === "jumpStartWorld" )
	{
		this.scene.add(instance);
		this.world = instance;
	}
	else
		options.parent.add(instance);

	// We will need to check for spawn listeners on this object before the next tick
	if( options.isInitialSync )
		instance.__isInitialSync = true;

//	if( !options.isInitialSync )
		this.freshObjects.push(instance);

	// Compute a collision radius based on a bounding sphere for a child mesh that contains geometry
	var computedBoundingSphere = null;
	var i, mesh;
	for( i in instance.children )
	{
		mesh = instance.children[i];

		if( mesh.geometry.faces.length > 0 )
		{
			mesh.geometry.computeBoundingSphere();
			computedBoundingSphere = mesh.geometry.boundingSphere.clone();
			computedBoundingSphere.radius *= 1.15;	// Scale up slightly
			break;
		}
	}

	// List all the object-level listeners
	var validEvents = ["tick", "cursorenter", "cursorexit", "cursordown", "cursorup", "spawn", "remove"];
	var computedListeners = {};
	for( i in validEvents )
		computedListeners[validEvents[i]] = {};

	// Just extend this object instead of adding a namespace
	var originalAddEventListener = window.addEventListener;
	var originalRemoveEventListener = window.removeEventListener;

	var vitalDataNames = ["ownerID", "modelFile", "blocksLOS", "listeners", "behaviors"];	// These get synced
	var jumpStartData = {
		"ownerID": this.localUser.userID,
		"blocksLOS": false,
		"modelFile": modelFile,
		"boundingSphere": computedBoundingSphere,
		"listeners": computedListeners,
		"syncData": {},
		"spoofVisible": true,	// because Altspace does not respect object.visible values directly
		"syncKey": options.syncKey,
		"behaviors": {},
		"applyBehavior": function(behaviorName, options)
		{
			if( !!!options )
				options = {};

			var behavior = jumpStart.behaviors[behaviorName];
			if( !!behavior )
			{
				if( behavior.applyBehavior.call(this, options) )
					this.behaviors[behaviorName] = true;
				else
					console.warn("Behavior \"" + behaviorName + "\" failed to apply.");
			}
			else
				console.warn("Behavior \"" + behaviorName + "\" does not exist.");
		},
		"unapplyBehavior": function(behaviorName, options)
		{
			if( !!!options )
				options = {};

			var behavior = jumpStart.behaviors[behaviorName];
			if( !!behavior )
			{
				if( behavior.unapplyBehavior.call(this, options) )
					this.behaviors[behaviorName] = false;
				else
					console.warn("Behavior \"" + behaviorName + "\" failed to unapply.");
			}
			else
				console.warn("Behavior \"" + behaviorName + "\" does not exist.");
		},
		"sync": function(options)
		{
			if( !jumpStart.options.multiuserOnly )
				return;

			var defaultOptions = {
				"transform": false,
				"vitalData": false,
				"syncData": false
			};

			var autoOptions = {
					"transform": true,
					"vitalData": true,
					"syncData": true
				};

			// Merg options with defaultOptions, or use autoOptions if nothing at all is given.
			if( !!options )
			{
				var x;
				for( x in defaultOptions )
					options[x] = (!!options[x]) ? options[x] : defaultOptions[x];
			}
			else
				options = autoOptions;

			function makeSyncable(object, maxDepth, currentDepth)
			{
				if( arguments.length < 2 )
					maxDepth = 0;

				maxDepth = Infinity;

				if( arguments.length < 3 )
					currentDepth = 0;

				var result;
				var objectType = typeof object;
				if( objectType === "function" )
				{
					// Add function names for global functions
					funcName = object.name;

					if( !!funcName ) 
						result = funcName;
				}
				else if( objectType === "number" || objectType === "string" || objectType === "boolean" )
				{
					result = object;
				}
				else if( objectType === "object" )
				{
					result = {};

					var keys = Object.keys(object);
					var type, funcName;
					for( x in keys)
					{
						type = typeof object[keys[x]];
						if( type === "function" )
						{
							// Add TRUE for function names that are global functions
							funcName = object[keys[x]].name;
							if( !funcName )
							{
								// Functions with no names might be behavior functions.
								if( keys[x].indexOf("-") > 0 )
									funcName = keys[x];
							}

							if( !!funcName ) 
								result[keys[x]] = true;
						}
						else if( type === "object" && currentDepth < maxDepth )
							result[keys[x]] = makeSyncable(object[keys[x]], maxDepth, currentDepth + 1);
						else if( type === "number" || type === "string" || type === "boolean" )
							result[keys[x]] = object[keys[x]];
					}
				}

				return result;
			}

			var data = {};
			var x, y, z, i, keys, type;

			if( options.transform )
			{
				var transform = {
					"position": makeSyncable(this.position),
					"quaternion": makeSyncable(this.quaternion),
					"scale": makeSyncable(this.scale),
					"name": this.name
				};

				data.transform = transform;
			}

			if( options.vitalData )
			{
				var vitalData = {};
				for( i in vitalDataNames )
					vitalData[vitalDataNames[i]] = makeSyncable(this[vitalDataNames[i]]);

				data.vitalData = vitalData;
			}

			if( options.syncData )
			{
				var syncData = makeSyncable(this.syncData);
				data.syncData = syncData;
			}

			// FIX ME: Only non-default values should need to be stored on the firebase.
			if( this.syncKey )
			{
				jumpStart.selfSyncingObject = true;
				jumpStart.firebase.roomRef.child("objects").child(this.syncKey).update(data, function(error)
				{
					if( error )
						console.log("JumpStart: " + error);
				});
				jumpStart.selfSyncingObject = false;

				//console.log("JumpStart: Syncing object with key " + this.syncKey + ".");
			}
			else
			{
				jumpStart.selfSyncingObject = true;
				var ref = jumpStart.firebase.roomRef.child("objects").push(data, function(error)
				{
					if( error )
						console.log("JumpStart:" + error);
				});
				jumpStart.selfSyncingObject = false;

				this.syncKey = ref.key();
				jumpStart.syncedObjects[ref.key()] = this;

				console.log("JumpStart: Syncing object with key " + ref.key() + " for the first time.");
			}
		},
		"addEventListener": function(eventType, listener)
		{
			// Make sure this is a valid event type
			if( validEvents.indexOf(eventType) < 0 )
			{
				console.warn("JumpStart: Invalid event type \"" + eventType + "\" specified. Applying as non-JumpStart listener.");
				originalAddEventListener.apply(window, arguments);
				return;
			}

			// Create the container if this is the first listener being added for this event type
			if( !this.listeners.hasOwnProperty(eventType) )
				this.listeners[eventType] = {};

			// Determine if this is a global named function that can be used as a synced listener
			var listenerName = listener.name;
			var isLocalListener;
			if( listenerName === "" )
				isLocalListener = true;
			else
				isLocalListener = (typeof window[listenerName] !== "function");

			if( isLocalListener )
			{
				// Check for behavior listeners too
				var x, y, behavior, handler, doBreak;
				for( x in jumpStart.behaviors )
				{
					behavior = jumpStart.behaviors[x];
					for( y in behavior )
					{
						handler = behavior[y];
						
						if( handler === listener )
						{
							listenerName = x + "-" + y;
							isLocalListener = false;
							doBreak = true;
							break;
						}
					}

					if( doBreak )
						break;
				}
			}

			if( isLocalListener )
			{
//				if( jumpStart.options.multiuserOnly )
//					console.warn("JumpStart: Only global functions can be synced as event listeners.");

				// Generate a name for this non-synced listener.
				var highestLocal = 0;
				var x, high;
				for( x in this.listeners[eventType] )
				{
					if( x.indexOf("_local") === 0 )
					{
						high = parseInt(x.substring(6));

						if( high > highestLocal )
							highestLocal = high;
					}
				}

				listenerName = "_local" + (highestLocal + 1);
			}

			// Assign the listener
			this.listeners[eventType][listenerName] = listener;

			// BaseClass::addEventListener
			originalAddEventListener.apply(window, arguments);
		}.bind(instance),
		"removeEventListener": function(eventType, listener)
		{
			// Make sure this is a valid event type
			if( validEvents.indexOf(eventType) < 0 )
			{
				console.warn("JumpStart: Invalid event type \"" + eventType + "\" specified. Removing as non-JumpStart listener.");
				originalRemoveEventListener.apply(window, arguments);
				return;
			}

			if( this.listeners.hasOwnProperty(eventType) )
			{
				var x;
				for( x in this.listeners[eventType] )
				{
					if( this.listeners[eventType][x] === listener )
					{
						delete this.listeners[eventType][x];
						return;
					}
				}
			}

			// BaseClass::addEventListener
			originalRemoveEventListener.apply(window, arguments);
		}.bind(instance),
		"hasEventListener": function(eventType, listener)
		{
			// Make sure this is a valid event type
			if( validEvents.indexOf(eventType) < 0 )
			{
				console.warn("JumpStart: Invalid event type \"" + eventType + "\" specified. Removing as non-JumpStart listener.");
				originalRemoveEventListener.apply(window, arguments);
				return;
			}

			if( this.listeners.hasOwnProperty(eventType) )
			{
				var x;
				for( x in this.listeners[eventType] )
				{
					if( this.listeners[eventType][x] === listener )
					{
						return true;
					}
				}

				return false;
			}

			// BaseClass::addEventListener
			originalRemoveEventListener.apply(window, arguments);
		}.bind(instance)
	};
	
	// If we are a network spawn, we need to merg our networkData in
	if( options.networkData )
	{
		// vitalData
		this.extractData.call(this, options.networkData.vitalData, jumpStartData);

		// syncData
		this.extractData.call(this, options.networkData.syncData, jumpStartData.syncData);

		this.syncedObjects[options.syncKey] = instance;
	}

	var x;
	for( x in jumpStartData )
	{
		// Warn if we are overwriting anything (other than *EventListener methods, because we call BaseClass on those).
		if( typeof instance[x] !== "undefined" && x !== "addEventListener" && x !== "removeEventListener" && x !== "hasEventListener" )
			console.warn("JumpStart: Object already has property " + x + ".");
		
		instance[x] = jumpStartData[x];
	}

	// JumpStart object bookkeeping.
	this.objects[instance.uuid] = instance;

//	console.log("JumpStart: Spawned an object.");
	return instance;
};

JumpStart.prototype.addEventListener = function(eventType, listener)
{
	var validEvents = Object.keys(this.listeners);

	// Make sure this is a valid event type
	if( validEvents.indexOf(eventType) < 0 )
	{
		console.warn("JumpStart: Invalid event type \"" + eventType + "\" specified.");
		return;
	}

	// Create the container if this is the first listener being added for this event type
	if( !this.listeners.hasOwnProperty(eventType) )
		this.listeners[eventType] = {};

	// Determine if this is a global named function that can be used as a synced listener
	/* FIX ME: Synced window.JumpStart-level events might be how some people prefer to code.
		Look at the object.JumpStart-level events for reference on how to add it later.
	*/

	var isLocalListener, listenerName;
	if( listener.name === "" )
		isLocalListener = true;
	else
		isLocalListener = (typeof window[listener.name] !== "function");

	if( isLocalListener )
	{
		// Generate a name for this non-synced listener.
		var highestLocal = 0;
		var x, high;
		for( x in this.listeners[eventType] )
		{
			if( x.indexOf("_local") === 0 )
			{
				high = parseInt(x.substring(6));

				if( high > highestLocal )
					highestLocal = high;
			}
		}

		listenerName = "_local" + (highestLocal + 1);
	}
	else
		listenerName = listener.name;

	// Assign the listener
	this.listeners[eventType][listenerName] = listener;
};

JumpStart.prototype.removeEventListener = function(eventType, listener)
{
	var validEvents = Object.keys(this.listeners);

	// Make sure this is a valid event type
	if( validEvents.indexOf(eventType) < 0 )
	{
		console.warn("JumpStart: Invalid event type \"" + eventType + "\" specified.");
		return;
	}

	if( this.listeners.hasOwnProperty(eventType) )
	{
		var x;
		for( x in this.listeners[eventType] )
		{
			if( this.listeners[eventType][x] === listener )
			{
				delete this.listeners[eventType][x];
				return;
			}
		}
	}

	console.warn("JumpStart: The specificed " + eventType + " listener was not found in removeEventListener.");
};


JumpStart.prototype.displayInfoPanel = function(panelName, data)
{
	switch(panelName)
	{
		case "beamMe":
			var container = document.createElement("div");
			container.style.cssText = "position: fixed; top: 0px; left: 0; width: 100%; height: 100%;";

			var imageContainer = document.createElement("div");
			imageContainer.style.cssText = "position: absolute; top; 0; left: 0; width: 59px;";
			container.appendChild(imageContainer);

			var imageElem = document.createElement("img");
			imageElem.style.minHeight = "50px";
			imageElem.style.maxHeight = "65px";
			this.throbHeightDOM(imageElem, 500);	// Make this image throb
			imageElem.src = "engine/misc/beamarrow.png";
			imageContainer.appendChild(imageElem);
			container.appendChild(imageContainer);

			var textElem = document.createElement("div");
			textElem.style.cssText = "position: absolute; top: 80px; width: 200px; padding: 10px; font-family: Arial; font-weight: 900; background-color: rgba(60, 144, 196, 0.5); border: 2px solid rgba(100, 255, 255, 0.8);";
			textElem.innerHTML = "Beam this app to an enclosure to begin!";
			container.appendChild(textElem);

			var readyElem = document.createElement("div");
			readyElem.style.cssText = "color: rgba(255, 255, 255, 1.0); position: fixed; top: 0; left: 0; bottom: 0; right: 0; width: 50%; height: 50%; margin: auto; font-size: 100px; font-weight: bold; letter-spacing: 0.1em; font-style: italic; font-family: Arial; text-shadow: 4px 4px rgba(60, 144, 196, 0.8);";
			readyElem.innerHTML = "READY";
			this.throbScaleDOM(readyElem, 2000, 1.1);
			container.appendChild(readyElem);

			document.body.appendChild(container);
			break;
	}
};

JumpStart.prototype.throbScaleDOM = function(elem, interval, scale)
{
	// Immediately set it's transform
	elem.style.webkitTransform = "scale(" + (1.0 - (scale - 1.0)) + ")";

	// Start rocking right away
	// FIX ME: If this is an image (elem.tagName === "IMG") then we whould use an onLoad promise for it before continuing.
	this.DOMLoaded().then(function()
	{
		setTimeout(function()
		{
			elem.style.transition = (interval / 1000.0) + "s ease-in-out";
			elem.style.webkitTransform = "scale(" + scale + ")";

			// Rock on an interval also
			elem.throbDirection = 1;
			elem.throbHandle = setInterval(function()
			{
				if( elem.throbDirection === 1 )
				{
					elem.style.webkitTransform = "scale(" + (1.0 - (scale - 1.0)) + ")";
					elem.throbDirection = -1;					
				}
				else
				{
					elem.style.webkitTransform = "scale(" + scale + ")";
					elem.throbDirection = 1;
				}
			}, interval);
		}.bind(this), 0);
	}.bind(elem));
};

JumpStart.prototype.rockDOM = function(elem, interval, degrees)
{
	// Immediately set it's transform
	elem.style.webkitTransform = "rotate(" + degrees + "deg)";

	// Start rocking right away
	// FIX ME: If this is an image (elem.tagName === "IMG") then we whould use an onLoad promise for it before continuing.
	this.DOMLoaded().then(function()
	{
		setTimeout(function()
		{
			elem.style.transition = (interval / 1000.0) + "s ease-in-out";
			elem.style.webkitTransform = "rotate(" + (-degrees) + "deg)";

			// Rock on an interval also
			elem.rockDirection = 1;
			elem.rockHandle = setInterval(function()
			{
				if( elem.rockDirection === 1 )
				{
					elem.style.webkitTransform = "rotate(" + degrees + "deg)";
					elem.rockDirection = -1;					
				}
				else
				{
					elem.style.webkitTransform = "rotate(" + (-degrees) + "deg)";
					elem.rockDirection = 1;
				}
			}, interval);
		}.bind(this), 0);
	}.bind(elem));
};

JumpStart.prototype.throbHeightDOM = function(elem, interval)
{
	// Immediately set it's size to min-height
	elem.style.height = elem.style.minHeight;

	// Start throbbing right away
	// FIX ME: If this is an image (elem.tagName === "IMG") then we whould use an onLoad promise for it before continuing.
	this.DOMLoaded().then(function()
	{
		setTimeout(function()
		{
			elem.style.height = this.style.maxHeight;
			elem.style.transition = "height " + (interval / 1000.0) + "s ease-in-out";

			// Throb on an interval too
			elem.throbDirection = 1;
			elem.throbHandle = setInterval(function()
			{
				if( elem.throbDirection === 1 )
				{
					elem.style.height = elem.style.minHeight;
					elem.throbDirection = -1;					
				}
				else
				{
					elem.style.height = elem.style.maxHeight;
					elem.throbDirection = 1;
				}
			}, interval);
		}.bind(this), 0);
	}.bind(elem));
};

JumpStart.prototype.loadStylesheets = function(fileNames)
{
	// Decalre some important variables
	var filesLoaded = 0;

	// Async
	return {
			"then": function(loadStylesheetsCallback)
			{
				loadAStylesheet(fileNames[filesLoaded], loadStylesheetsCallback);
			}
		};

	// Helper functions (that use the important variables)
	function loadAStylesheet(fileName, loadStylesheetsCallback)
	{
		var elem = document.createElement("link");
		elem.rel = "stylesheet";
		elem.type = "text/css";
		elem.href = fileName;

		elem.addEventListener("load", function()
			{
				filesLoaded++;

				if( filesLoaded === fileNames.length )
					loadStylesheetsCallback();
				else
					loadAStylesheet(fileNames[filesLoaded], loadStylesheetsCallback);
			});

		// We are added to the head so loading will begin immediately & asynchronously
		document.getElementsByTagName("head")[0].appendChild(elem);
	}
};

JumpStart.prototype.loadJavaScripts = function(fileNames)
{
	// Decalre some important variables
	var filesLoaded = 0;

	// Async
	return {
			"then": function(loadJavaScriptsCallback)
			{
				//loadJavaScriptsCallback(fileNames[filesLoaded], loadJavaScriptsCallback);
				loadAJavaScript(fileNames[filesLoaded], loadJavaScriptsCallback);
			}
		};

	// Helper functions (that use the important variables)
	function loadAJavaScript(fileName, loadJavaScriptsCallback)
	{
		var elem = document.createElement("script");
		elem.type = "text/javascript";
		elem.src = fileName;

		elem.addEventListener("load", function()
		{
			filesLoaded++;

			if( filesLoaded === fileNames.length )
				loadJavaScriptsCallback();
			else
				loadAJavaScript(fileNames[filesLoaded], loadJavaScriptsCallback);
		});

		// We are added to the head so loading will begin immediately & asynchronously
		document.getElementsByTagName("head")[0].appendChild(elem);
	}
};

JumpStart.prototype.loadImages = function(fileNames)
{
	// Decalre some important variables
	var filesLoaded = 0;

	// Async
	return {
			"then": function(loadImagesCallback)
			{
				loadAnImage(fileNames[filesLoaded], loadImagesCallback);
			}
		};

	// Helper functions (that use the important variables)
	function loadAnImage(fileName, loadImagesCallback)
	{
		var elem = new Image();

		elem.addEventListener("load", function(e)
		{
			onLoadOrFail(e, loadImagesCallback);
		}, true);

		elem.addEventListener("error", function(e)
		{
			onLoadOrFail(e, loadImagesCallback);
		}, true);

		elem.src = fileName;

		function onLoadOrFail(e, loadImagesCallback)
		{
			filesLoaded++;

			if( filesLoaded === fileNames.length )
				loadImagesCallback();
			else
				loadAnImage(fileNames[filesLoaded], loadImagesCallback);
		}
	}
};

// Figure out if we are passed a roomID in our URL
// Based on the function at: https://css-tricks.com/snippets/javascript/get-url-variables/
JumpStart.prototype.getQueryVariable = function(name)
{
	var query = window.location.search.substring(1);
	var vars = query.split("&");
	var i;
	for( i in vars )
	{
		var pair = vars[i].split("=");
		if( pair[0] === name )
			return pair[1];
	}

	return null;
};

JumpStart.prototype.DOMReady = function()
{
	// Async
	return {
			"then": function(DOMReadyCallback)
			{
				if( document.readyState === "interactive" || document.readyState === "complete" )
					DOMReadyCallback();
				else
				{
					function readyWatch(DOMEvent)
					{
						DOMReadyCallback();
					}

					document.addEventListener("DOMContentLoaded", readyWatch.bind(this), true);
				}
			}.bind(this)
		};
}

JumpStart.prototype.DOMLoaded = function()
{
	// Async
	return {
			"then": function(DOMLoadedCallback)
			{
				if( document.readyState === "complete" )
					DOMLoadedCallback();
				else
				{
					function readyWatch(DOMEvent)
					{
						DOMLoadedCallback();
					}

					document.addEventListener("DOMLoadedCallback", readyWatch.bind(this), true);
				}
			}.bind(this)
		};
}

window.loadJumpStart = function(options)
{
	window.jumpStart = new JumpStart(options);
};

				/* LERP MOVE BEHAVIOR PROTOTYPE (needs refinement)
				car.addEventListener("spawn", function(isInitialSync)
				{
					// car.applyBehavior("lerpMove");
					var distance = jumpStart.localUser.cursorHit.scaledPoint.distanceTo(this.position);
					//var speed = 100.0;
					var autoSpeed = 50 + (0.9 * distance);

					this.syncData.lerpMove = {};
					this.syncData.lerpMove.target = jumpStart.localUser.cursorHit.scaledPoint.clone();
					this.syncData.lerpMove.time =  distance / autoSpeed;

					this.userData.lerpMove = {};
					this.userData.lerpMove.original = this.position.clone();
					this.userData.lerpMove.amount = 0.0;

					this.addEventListener("tick", function()
					{
						if( this.userData.lerpMove.amount < 1.0 )
						{
							this.userData.lerpMove.amount += jumpStart.deltaTime / this.syncData.lerpMove.time;

							var justFinished = false;
							if( this.userData.lerpMove.amount >= 1.0 )
							{
								this.userData.lerpMove.amount = 1.0;
								justFinished = true;
							}

							this.position.lerpVectors(this.userData.lerpMove.original, this.syncData.lerpMove.target, this.userData.lerpMove.amount);

							if( justFinished )
							{
								console.log("Animation finished!");
							}
						}
					});
				});
				*/