GameScene = pc.Scene.extend('GameScene',
    { },
    {
        gameLayer:null,
        box:null,

        init:function () {
            this._super();

            //-----------------------------------------------------------------------------
            // game layer
            //-----------------------------------------------------------------------------
            this.gameLayer = this.addLayer(new pc.EntityLayer('game layer', 10000, 10000));

            // all we need is the render system
            this.gameLayer.addSystem(new pc.systems.Render());


        },

        onAction:function (actionName, event, pos) {
            if (actionName === 'move')
                this.box.getComponent('spatial').pos.x += 10;
        },

        process:function () {
            //
            // ... do extra processing in here
            //

            // clear the background
            pc.device.ctx.clearRect(0, 0, pc.device.canvasWidth, pc.device.canvasHeight);

            // always call the super
            this._super();
        }
    });

EntityFactory = pc.EntityFactory.extend('EntityFactory', {},
    {
        packageSheet:null,
        playerSheet:null,
        init:function(){
            this.packageSheet = new pc.SpriteSheet({image:pc.device.loader.get('package').resource, useRotation:false});
            this.playerSheet = new pc.SpriteSheet({image:pc.device.loader.get('player').resource, useRotation:true});
        },
        createEntity:function (layer, type, x, y, dir)
        {
            var e = null;

            switch (type)
            {
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
                            states:[
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


            // no resources are loaded in this template, so this is all commented out
            pc.device.loader.add(new pc.Image('player', 'images/figur.png'));
            pc.device.loader.add(new pc.Image('package', 'images/paket.png'));
            pc.device.loader.add(new pc.Image('tiles', 'images/tiles.png'));

//            if (pc.device.soundEnabled)
//                pc.device.loader.add(new pc.Sound('fire', 'sounds/fire', ['ogg', 'mp3'], 15));

            this.loadingScene = new pc.Scene();
            this.loadingLayer = new pc.Layer('loading');
            this.loadingScene.addLayer(this.loadingLayer);

            // fire up the loader
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


