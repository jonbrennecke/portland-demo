$(document).ready( function () {	


	$("#hide-text").click(function(){
		$(".textbox-wrap").animate({right:"-60%"},500)
	});

	// allow us to load cross-origin image textures from imgur
	THREE.ImageUtils.crossOrigin = "anonymous";

	/*

		There's a lot of globals going on here... usually that's not a good thing; however it 
		really helps to be able to access all the scene elements.

	*/ 

	var parent = $('#canvas-wrap'),
		height = parent.height(),
		width = parent.width(), 
		
		// blurred scene objects
		blurred_elem = $(".blurred"),
		blurred = {
			elem : blurred_elem,
			offset : blurred_elem.offset(),
			width : blurred_elem.width()|0,
			height : blurred_elem.height()|0,
		},
		
		// THREE.js scene objects
		scene = new THREE.Scene(),
		camera = new THREE.PerspectiveCamera( 50, width / height, 1, 10 ),
		renderer = new THREE.WebGLRenderer( { antialias : true, alpha : true, preserveDrawingBuffer : true } ),
		clock = new THREE.Clock(true),

		// for the blurred textbox background setup function
		gl = renderer.getContext(),
		buffer = new Uint8Array(blurred.width*blurred.height*4),

		// depth scene and camera
		depth = {
			material : new THREE.MeshDepthMaterial(),
			renderTarget : undefined,
		},
		
		// trackball controls
		controls,
		
		// effects composers
		effectComposer, 
		composer,

		// image links
		images = {
			elev : "http://i.imgur.com/2y2xvBq.jpg",
			sat : "http://i.imgur.com/rex5rzk.jpg",
		},

		/*

			fragment and vertex shaders are loaded from the html file where Jade pulls them from 
			their own *.fs and *.vs files.

		*/
		shaders = {

			// this is not additive blending. this is just some test shader; ignore it.
			addblend : {
				uniforms : {
					tSource1: { type: "t", texture: null },
					tSource2: { type: "t", texture: null },
					iResolution : { type: "v2", value : new THREE.Vector2(width,height) },
					iGlobalTime : { type: "f", value : 0.0 }
				},
				vertexShader : $("#basic")[0].innerText,
				fragmentShader : $("#addblend")[0].innerText
			},

			// map material shader
			map : {
				uniforms : {
					heightIntensity : { type : "f", value : 0.5 },
					pointLightColor : { type : "v3v", value: [] },
					pointLightPosition : { type : "v3v", value: [] },
					pointLightIntensity : { type : "fv1", value: [] },
					tSatellite: { type: "t", texture: null, value : THREE.ImageUtils.loadTexture(images.sat,THREE.UVMapping, function (tex){
						
						// this is bad programming and might create a race condition. 
						// TODO clean this up
						// TODO go to sleep

						shaders.map.uniforms.iTexResolution.value.set(tex.image.width,tex.image.height);

					})},
					tElevation: { type: "t", texture: null, value : THREE.ImageUtils.loadTexture(images.elev) },
					iTexResolution : { type : "v2", value : new THREE.Vector2(0.0,0.0) }
				},
				vertexShader : $("#mapvs")[0].innerText,
				fragmentShader : $("#mapfs")[0].innerText,
				shading : THREE.SmoothShading,
			},

			// generates depth field as texture
			depth : {
				uniforms : {
					tDepth : { type: "t", texture: null },
					tRender : { type: "t", texture: null },
					znear : { type: "f", value : camera.near },
					zfar : { type: "f", value : camera.far },
					iResolution : { type: "v2", value : new THREE.Vector2(width,height) },
					focalDepth : { type: "f", value: 10.5 },
					focalLength : { type: "f", value: 2.5 },
					fstop: { type: "f", value: 0.5 },
					dithering : { type: "f", value: 0.0001 },
					maxblur : { type: "f", value: 4.0 },
					threshold : { type: "f", value: 4 },
					gain : { type: "f", value: 1.0 },
					bias : { type: "f", value: 1.0 },
					fringe : { type: "f", value: 7 },
				},
				vertexShader : $("#basic")[0].innerText,
				fragmentShader : $("#depth")[0].innerText
			},

			// horizontal blur for bloom filter
			hblur : {
				uniforms : {
					tDiffuse: { type: "t", texture: null },
					glomap: { type: "t", texture: null },
					blurSize : { type: "f", value: 0.002 }
				},
				vertexShader : $("#basic")[0].innerText,
				fragmentShader : $("#hblur")[0].innerText
			},

			// vertical blur for bloom filter
			vblur : {
				uniforms : {
					tDiffuse: { type: "t", texture: null },
					glomap: { type: "t", texture: null },
					blurSize : { type: "f", value: 0.002 } 
				},
				vertexShader : $("#basic")[0].innerText,
				fragmentShader : $("#vblur")[0].innerText
			}
		},

		blendPass, // needs to be global to we can modify uniforms in the render loop
		tack; // tack model imported from blender


	function initShaders () {

		/*
			
			load the shaders and set up some render targets and composers

		*/

		// render target parameters
		var renderTargetParameters = { 
				minFilter: THREE.LinearFilter, 
				magFilter: THREE.LinearFilter, 
				format: THREE.RGBAFormat, 
				stencilBufer: false 
			},
			renderTargetBloom = new THREE.WebGLRenderTarget( width, height, renderTargetParameters ),
			renderEffectsPass = new THREE.RenderPass( scene, camera);

		effectComposer = new THREE.EffectComposer( renderer, renderTargetBloom );
		effectComposer.addPass( renderEffectsPass );

		var renderTarget = new THREE.WebGLRenderTarget( width, height, renderTargetParameters );
		composer = new THREE.EffectComposer( renderer, renderTarget );
		var renderPass = new THREE.RenderPass( scene, camera );
		composer.addPass( renderPass );

		// render target to generate a depth buffer
		// could make this another pass, instead of another renderTarget
		depth.renderTarget = new THREE.WebGLRenderTarget( width, height, renderTargetParameters );

		shaders.depth.uniforms.tRender.value = effectComposer.renderTarget2;
		shaders.depth.uniforms.tDepth.value = depth.renderTarget;
		var depthPass = new THREE.ShaderPass( shaders.depth );
		composer.addPass( depthPass );
		depthPass.renderToScreen = true;

		// // horizontal pass for bloom filter
		// shaders.hblur.uniforms.glomap.value = effectComposer.renderTarget2;
		// var horizontalPass = new THREE.ShaderPass( shaders.hblur );
		// composer.addPass( horizontalPass );

		// // vertical pass for bloom filter
		// shaders.vblur.uniforms.glomap.value = composer.renderTarget1;
		// var verticalPass = new THREE.ShaderPass( shaders.vblur );
		// composer.addPass( verticalPass );
		// verticalPass.renderToScreen = true;

		// shaders.addblend.uniforms.tSource1.value = effectComposer.renderTarget2;
		// shaders.addblend.uniforms.tSource2.value = composer.renderTarget2;
		// blendPass = new THREE.ShaderPass( shaders.addblend );
		// composer.addPass( blendPass );
		// blendPass.renderToScreen = true; // make this the final pass

	}

	function setupBlurredBackground () {

		/*

			"In which a text box background is blurred through very complicated means"

			First the 3D webgl canvas is saved to a framebuffer, then the pixel framebuffer 
			data is read into a 2D canvas, which is blurred by CSS.

			Its worth noting that something like:

				blurred.elem.css({ "background-image" : "url(" + renderer.domElement.toDataURL() + ")" });

			is a much easier way to do this, but its reaaaalllly slow for larger screens.

		*/

		var fb = gl.createFramebuffer(),
			texture = gl.createTexture();

		// set up a framebuffer and texture to render the scene into
		gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
		fb.height = height;
		fb.width = width;

		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); 
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, width, height, 0, gl.RGB, gl.UNSIGNED_BYTE, null);

		// attach the texture to the framebuffer.
		gl.framebufferTexture2D(
		    gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
		    gl.TEXTURE_2D, texture, 0);

		// check if the texture is readable
		if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) == gl.FRAMEBUFFER_COMPLETE) {

			renderer.render( scene, camera )

			// read pixels from the main scene into an array buffer
			gl.readPixels(blurred.offset.left|0,blurred.offset.top|0,blurred.width,blurred.height,gl.RGBA,gl.UNSIGNED_BYTE,buffer);

			// place the raw pixels into the blurred canvas
			// (in WebGL/OpenGL coords, the origin is in bottom-left not the top left)
			var i = blurred.height, k = 0;
			while( --i )
			{
				for (var j = 0; j < blurred.width*4; j++, k++) {
					blurred.imageData.data[k] = buffer[i*blurred.width*4+j];
				}
			}
			blurred.ctx.putImageData(blurred.imageData,0,0,0,0,blurred.width,blurred.height);
		}

		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}

	// init scene
	function init () {

		/*
			
			initiate all the scene elements and GL objects

		*/

		// setup the canvas for the blurred textbox background
		blurred.canvas = $("<canvas/>").appendTo(blurred.elem)[0];
		blurred.canvas.width = blurred.width;
		blurred.canvas.height = blurred.height;
		blurred.ctx = blurred.canvas.getContext("2d");
		blurred.imageData = blurred.ctx.getImageData(0,0,blurred.width,blurred.height);

		// setup the renderer for the main scene
		renderer.setSize( width, height );
		renderer.shadowMapEnabled = true;
		renderer.setClearColor( 0x000000, 0 );
		$( renderer.domElement ).appendTo( parent);

		camera.position.set(0,-3,2.5);
		camera.lookAt(new THREE.Vector3(0,0,0)); 

		// trackball controls
		controls = new THREE.TrackballControls( camera );
		controls.rotateSpeed = 1.0;
		controls.zoomSpeed = 1.2;
		controls.panSpeed = 0.8;
		controls.noZoom = false;
		controls.noPan = false;
		controls.staticMoving = true;
		controls.dynamicDampingFactor = 0.3;
		controls.keys = [ 65, 83, 68 ];
		// controls.addEventListener('change', setupBlurredBackground);

		// load the tack mark
		var loader = new THREE.JSONLoader();
		loader.load( "http://codepen.io/jonbrennecke/pen/xaFsm.js", 
		function (geometry) { 
			var material = new THREE.MeshLambertMaterial({
				color : 0xb1926c,
				shading: THREE.SmoothShading,
				side : THREE.DoubleSide,
				shininess : 10
			});
			tack = new THREE.Mesh(geometry, material);
			tack.position.set(2,0,0.5);
			tack.rotation.set(20,0,0);
			tack.scale.set(0.15,0.15,0.15);
			scene.add(tack);
		});

		var plane = new THREE.Mesh(
			new THREE.PlaneGeometry( 8, 5, 100, 100 ),  // the generated jpgs are both 4.8x3
			new THREE.ShaderMaterial( shaders.map ));
		plane.position.set(0,0,0);
		plane.rotation.set(0,0,3);

		// return random numbers between max and min
		function rand( max, min ) { return Math.random() * ( max - min ) + min; }

		// particle system geomety
		var geometry = new THREE.Geometry();
		for (var i = 0; i < 10000; i++) {
			geometry.vertices.push( new THREE.Vector3(
				rand(5,-5), rand(5,-5), rand(5,-5)
			));
			geometry.colors[i] = new THREE.Color(0xC2B49A);
		};

		// particle system
		var psys = new THREE.PointCloud(geometry, new THREE.PointCloudMaterial({
			size : 0.025,
			vertexColors : true
		}))
		psys.sortParticles = true;

		// lights
		var l1 = new THREE.PointLight( 0xffa878, 1.0 ),
			l2 = new THREE.PointLight( 0xb454ab, 0.5 );
			l3 = new THREE.PointLight( 0x516fbd, 0.5 );

		l1.position.set(0,0,15);
		l2.position.set(15,0,0);
		l3.position.set(0,15,0);

		shaders.map.uniforms.pointLightColor.value = [ 
			new THREE.Vector3(l1.color.r,l1.color.g,l1.color.b),
			new THREE.Vector3(l2.color.r,l2.color.g,l2.color.b),
			new THREE.Vector3(l3.color.r,l3.color.g,l3.color.b)];
		shaders.map.uniforms.pointLightPosition.value = [ l1.position, l2.position, l3.position ];
		shaders.map.uniforms.pointLightIntensity.value = [ l1.intensity, l2.intensity, l3.intensity ];

		scene.add(plane);
		scene.add(psys);
		scene.add(l1);
		scene.add(l2);
		scene.add(l3);
	}

	window.addEventListener( 'resize', onWindowResize, false );

	function onWindowResize() {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize( window.innerWidth, window.innerHeight );
		controls.handleResize();
	}

	function render () {
		// render depth data to a buffer
		scene.overrideMaterial = depth.material;
		renderer.render( scene, camera, depth.renderTarget, true );

		// blendPass.material.uniforms.iGlobalTime.value = clock.getElapsedTime();
		effectComposer.render();
		composer.render();

		setupBlurredBackground();
	}

	function animate () {
		requestAnimationFrame(animate);
		controls.update();
		render();
	}


	/*


		Alright! We're almost done here... 

		all that's left is to run the setup functions and start the animation!

	*/

	init();
	initShaders();
	animate();

});