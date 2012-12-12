BackgroundLayer = pc.Layer.extend('background',
    {},
    {
        background:null,

        init:function () {
            this._super('background', 1);

            this.background = pc.device.loader.get('background').resource;
        },
        draw:function () {
            this.background.draw(pc.device.ctx, 0, 0);
        }
    }
);

PackageSystem = pc.systems.EntitySystem('PackageSystem', {}, {
    packages:null,
    tileMap:null,

    init:function (packages, tileMap) {
        this.tileMap = tileMap;
        this.packages = packages;

        this._super([ 'package' ]);
    },

    push:function (startPoint, offset) {

        var target = pc.Point.create((startPoint.x + offset.x), (startPoint.y + offset.y));

        var pushedPackage = this.getPackage(target);
        if (pushedPackage) {
            var spatial = pushedPackage.object().getComponent('spatial');
            // check if we'll move into another package, if so, stop movement
            var nextPoint = pc.Point.create(target.x + offset.x, target.y + offset.y);
            if (this.getPackage(nextPoint)) {
                return false;
            }
            // check if we'll be pushing this onto a wall
            if (this.onTile(nextPoint, 'wall')) {
                return false;
            }

            spatial.pos.x += offset.x;
            spatial.pos.y += offset.y;
            return true;
        } else {
            return true;
        }
    },

    getPackage:function (target) {
        var pack = this.packages.first;

        while (pack) {
            var spatial = pack.object().getComponent('spatial');
            var location = spatial.getScreenRect();

            if (location.containsPoint(target)) {
                return pack;
            }

            pack = pack.next();
        }
        return null;
    },

    onTile:function (target, type) {
        var tileX = Math.floor(target.x / 32);
        var tileY = Math.floor(target.y / 32);
        return (this.tileMap.tileHasProperty(tileX, tileY, type));
    }

});

PlayerControlSystem = pc.systems.Input.extend('PlayerControlSystem',
    { },
    {
        playerSpatial:null,
        packageSystem:null,
        tileMap:null,
        init:function (playerSpatial, packageSystem, tileMap) {
            this.tileMap = tileMap;
            this.playerSpatial = playerSpatial;
            this.packageSystem = packageSystem;
            this._super([ 'input' ], 60);
        },

        onAction:function (actionName) {
            var movementOffset;
            var direction;

            if (actionName === 'right') {
                movementOffset = pc.Point.create(32, 0);
                direction = 180;
            }
            if (actionName === 'left') {
                movementOffset = pc.Point.create(-32, 0);
                direction = 0;

            }
            if (actionName === 'up') {
                movementOffset = pc.Point.create(0, -32);
                direction = 90;
            }
            if (actionName === 'down') {
                movementOffset = pc.Point.create(0, 32);
                direction = 270;
            }

            this.playerSpatial.dir = direction;

            if (this.leavingMap(movementOffset)) {
                return;
            }

            var wasAbleToPush = this.packageSystem.push(this.playerSpatial.getCenterPos(), movementOffset);
            if (wasAbleToPush) {
                this.playerSpatial.pos.x += movementOffset.x;
                this.playerSpatial.pos.y += movementOffset.y;
            }
        },

        leavingMap:function (offset) {
            var tileX = Math.floor((offset.x + this.playerSpatial.pos.x) / 32);
            var tileY = Math.floor((offset.y + this.playerSpatial.pos.y) / 32);
            return (this.tileMap.tileHasProperty(tileX, tileY, 'wall'));
        }
    }
);

GameScene = pc.Scene.extend('GameScene',
    { },
    {
        gameLayer:null,
        entityFactory:null,
        backgroundLayer:null,
        finishLayer:null,
        tileLayer:null,
        level:1,
        player:null,
        playerSpatial:null,
        displayedWin:false,
        starSheet:null,
        currentLevel: null,

        init:function () {
            this._super();
            pc.device.input.bindState(this, 'mouseclick', 'MOUSE_LEFT_BUTTON');
            this.entityFactory = new EntityFactory();
            this.loadLevel('level1');

        },

        loadLevel:function (lvl) {
            this.currentLevel = lvl;
            var next = this.layers.first;
            while (next) {
                if (next.obj.reset) next.obj.reset();
                next = next.next();
            }

            this.layers.clear();
            this.activeLayers.clear();

            this.displayedWin = false;

            this.loadFromTMX(pc.device.loader.get(lvl).resource, this.entityFactory);

            this.tileLayer = this.get('tiles');
            this.tileLayer.setZIndex(11);

            this.gameLayer = this.get('entity');
            this.gameLayer.setZIndex(20);

            this.finishLayer = this.get('backgroundEntity');
            this.finishLayer.setZIndex(21);


            this.backgroundLayer = new BackgroundLayer();
            this.addLayer(this.backgroundLayer);


            // get the player entity
            this.player = this.gameLayer.entityManager.getTagged('PLAYER').first.object();
            this.playerSpatial = this.player.getComponent('spatial');

            this.packages = this.gameLayer.entityManager.getTagged('PACKAGE');

            this.finishLayer.addSystem(new pc.systems.Render());
            this.finishLayer.addSystem(new pc.systems.Particles());

            this.gameLayer.addSystem(new pc.systems.Render());
            this.gameLayer.addSystem(new pc.systems.Expiration());
            this.gameLayer.addSystem(new pc.systems.Activation(2000));
            this.gameLayer.addSystem(new pc.systems.Layout());
            var packageSystem = new PackageSystem(this.packages, this.tileLayer.tileMap);
            this.gameLayer.addSystem(new PlayerControlSystem(this.playerSpatial, packageSystem, this.tileLayer.tileMap));
            this.gameLayer.addSystem(packageSystem);

            var starsImage = pc.device.loader.get('stars').resource;
            this.starSheet = new pc.SpriteSheet({sourceX:20, image:starsImage, frameWidth:20, frameHeight:20, framesWide:3, framesHigh:3});

        },

        process:function () {

            var hasWon = this.checkWinner();

            var restartButton = this.finishLayer.entityManager.getTagged('RESTART').first.object();
            var nextLevelButton;

            if (this.finishLayer.entityManager.getTagged('NEXT_LEVEL')) {
                nextLevelButton = this.finishLayer.entityManager.getTagged('NEXT_LEVEL').first.object();
            }

            if (hasWon && !this.displayedWin) {
                this.displayedWin = true;
                var tree = this.finishLayer.entityManager.getTagged('TREE').first.object();
                tree.addComponent(pc.components.ParticleEmitter.create(
                    {
                        spriteSheet:this.starSheet,
                        burst:3,
                        delay:20,
                        thrustMin:5, thrustTime:200,
                        maxVelX:5, maxVelY:5,
                        rangeX:10, rangeY:10,
                        lifeMin:500,
                        alphaMin:1, alphaMax:1, alphaDelay:50,
                        gravityY:0,
                        compositeOperation:'lighter',
                        spinMin:-80, spinMax:80,
                        rotateSprite:true,
                        offsetX:38,
                        offsetY:2
                    }));
                var santa = this.finishLayer.entityManager.getTagged('SANTA').first.object();
                santa.getComponent('sprite').sprite.setAnimation('win');

            }

            if (pc.device.input.isInputState(this, 'mouseclick')) {
                this.handleMouseClick(restartButton, nextLevelButton, hasWon);
            }

            // always call the super
            this._super();
        },

        handleMouseClick:function (restartButton, nextLevelButton, hasWon) {
            if (restartButton && restartButton.getComponent('spatial').getScreenRect().containsPoint(pc.device.input.mousePos)) {
                if (!hasWon)
                    this.loadLevel(this.currentLevel);
                else
                    this.loadLevel('level1');
            }

            if (nextLevelButton && nextLevelButton.getComponent('spatial').getScreenRect().containsPoint(pc.device.input.mousePos)) {
                this.loadLevel('level2');
            }
        },

        checkWinner:function () {
            var pack = this.packages.first;

            while (pack) {
                var spatial = pack.object().getComponent('spatial');
                var location = spatial.getCenterPos();

                if (!this.onTile(location, 'finish')) {
                    return false;
                }
                pack = pack.next();
            }

            return true;

        },

        onTile:function (target, type) {
            var tileX = Math.floor(target.x / 32);
            var tileY = Math.floor(target.y / 32);
            return (this.tileLayer.tileMap.tileHasProperty(tileX, tileY, type));
        }
    });

EntityFactory = pc.EntityFactory.extend('EntityFactory', {},
    {
        packageSheet:null,
        playerSheet:null,
        santaSheet:null,
        treeSheet:null,
        playagainSheet:null,
        nextLevelSheet:null,

        init:function () {
            this.packageSheet = new pc.SpriteSheet({image:pc.device.loader.get('package').resource, useRotation:false});
            this.playerSheet = new pc.SpriteSheet({image:pc.device.loader.get('player').resource, useRotation:true});
            this.santaSheet = new pc.SpriteSheet({
                image:pc.device.loader.get('santa').resource,
                frameWidth:67,
                frameHeight:90
            });
            this.santaSheet.addAnimation({ name:'win', frameX:1, frameCount:1});
            this.santaSheet.addAnimation({ name:'wait', frameX:0, frameCount:1});

            this.treeSheet = new pc.SpriteSheet({image:pc.device.loader.get('tree').resource});
            this.playagainSheet = new pc.SpriteSheet({image:pc.device.loader.get('play_again').resource});
            this.nextLevelSheet = new pc.SpriteSheet({image:pc.device.loader.get('next_level').resource});

        },
        createEntity:function (layer, type, x, y, dir) {
            var e = null;

            switch (type) {
                case 'player':
                    e = pc.Entity.create(layer);
                    e.addTag('PLAYER');

                    e.addComponent(pc.components.Sprite.create(
                        {
                            spriteSheet:this.playerSheet
                        }));
                    e.addComponent(pc.components.Spatial.create({x:x, y:y, dir:0,
                        w:this.playerSheet.frameWidth, h:this.playerSheet.frameHeight}));
                    // input control
                    e.addComponent(pc.components.Input.create(
                        {
                            actions:[
                                ['right', ['D', 'RIGHT']],
                                ['left', ['A', 'LEFT']],
                                ['up', ['W', 'UP']],
                                ['down', ['S', 'DOWN']]
                            ]
                        }));

                    return e;

                case 'package':
                    e = pc.Entity.create(layer);
                    e.addTag('PACKAGE');

                    e.addComponent(pc.components.Sprite.create(
                        {
                            spriteSheet:this.packageSheet
                        }));
                    e.addComponent(pc.components.Spatial.create({x:x, y:y, dir:0,
                        w:this.packageSheet.frameWidth, h:this.packageSheet.frameHeight}));

                    return e;

                case 'tree':
                    e = pc.Entity.create(layer);
                    e.addTag('TREE');

                    e.addComponent(pc.components.Sprite.create(
                        {
                            spriteSheet:this.treeSheet
                        }));
                    e.addComponent(pc.components.Spatial.create({x:x, y:y, dir:0,
                        w:this.packageSheet.frameWidth, h:this.packageSheet.frameHeight}));

                    return e;

                case 'restart':
                    e = pc.Entity.create(layer);
                    e.addTag('RESTART');
                    e.addComponent(pc.components.Spatial.create({x:x, y:y, dir:0, w:this.playagainSheet.frameWidth, h:this.playagainSheet.frameHeight}));
                    e.addComponent(pc.components.Sprite.create(
                        {
                            spriteSheet:this.playagainSheet
                        }));
                    return e;

                case 'nextlevel':
                    e = pc.Entity.create(layer);
                    e.addTag('NEXT_LEVEL');
                    e.addComponent(pc.components.Spatial.create({x:x, y:y, dir:0, w:this.playagainSheet.frameWidth, h:this.playagainSheet.frameHeight}));
                    e.addComponent(pc.components.Sprite.create(
                        {
                            spriteSheet:this.nextLevelSheet
                        }));
                    return e;

                case 'santa':
                    e = pc.Entity.create(layer);
                    e.addTag('SANTA');

                    e.addComponent(pc.components.Sprite.create(
                        {
                            spriteSheet:this.santaSheet
                        }));
                    e.addComponent(pc.components.Spatial.create({x:x, y:y, dir:0,
                        w:this.packageSheet.frameWidth,
                        h:this.packageSheet.frameHeight}));

                    return e;


            }
            throw "Should never get here!"
        }
    }
);


TheGame = pc.Game.extend('TheGame',
    { },
    {
        gameScene:null,

        onReady:function () {
            this._super();

            // disable caching when developing
            if (pc.device.devMode)
                pc.device.loader.setDisableCache();

            pc.device.loader.add(new pc.Image('player', 'images/figur.png'));
            pc.device.loader.add(new pc.Image('package', 'images/paket.png'));
            pc.device.loader.add(new pc.Image('santa', 'images/nikol.png'));
            pc.device.loader.add(new pc.Image('tree', 'images/tree.png'));
            pc.device.loader.add(new pc.Image('stars', 'images/stars.png'));
            pc.device.loader.add(new pc.Image('basic', 'images/tiles.png'));
            pc.device.loader.add(new pc.Image('background', 'images/background.png'));
            pc.device.loader.add(new pc.Image('play_again', 'images/startbutton.png'));
            pc.device.loader.add(new pc.Image('next_level', 'images/button_neu.png'));

            pc.device.loader.add(new pc.DataResource('level1', 'data/level1.tmx'));
            pc.device.loader.add(new pc.DataResource('level2', 'data/level2.tmx'));

            this.loadingScene = new pc.Scene();
            this.loadingLayer = new pc.Layer('loading');
            this.loadingScene.addLayer(this.loadingLayer);

            pc.device.loader.start(this.onLoading.bind(this), this.onLoaded.bind(this));
        },

        onLoading:function (percentageComplete) {
            var ctx = pc.device.ctx;
            ctx.clearRect(0, 0, pc.device.canvasWidth, pc.device.canvasHeight);
            ctx.font = "normal 50px Verdana";
            ctx.fillStyle = "#88f";
            ctx.fillText('Christmas Sokoban', 40, (pc.device.canvasHeight / 2) - 50);
            ctx.font = "normal 18px Verdana";
            ctx.fillStyle = "#777";
            ctx.fillText('Loading: ' + percentageComplete + '%', 40, pc.device.canvasHeight / 2);
        },

        onLoaded:function () {
            // resources are all ready, start the main game scene
            // (or a menu if you have one of those)
            this.gameScene = new GameScene();
            this.addScene(this.gameScene);
        }
    });


