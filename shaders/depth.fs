
/*

Basic Depth of Field shader

based off some much better DoF shaders:

https://github.com/mrdoob/three.js/issues/3182
http://blenderartists.org/forum/showthread.php?237488-GLSL-depth-of-field-with-bokeh-v2-4-(update)
http://jabtunes.com/labs/3d/dof/webgl_postprocessing_dof2.html

*/

#define PI 3.1415926

uniform sampler2D tDepth; // depth buffer
uniform sampler2D tRender; // render buffer
uniform float znear; // camera clipping near plane
uniform float zfar; // camera clipping far plane
uniform vec2 iResolution; // screen resolution
uniform float focalLength; // camera focal length
uniform float focalDepth; // camera focal depth
uniform float fstop; // camera fstop
uniform float dithering; // amount of dithering
uniform float maxblur; // maximum amount of blur
uniform float threshold; // highlight threshold;,
uniform float gain; // highlight gain;,
uniform float bias; // bokeh edge bias,
uniform float fringe; // bokeh chromatic aberration / fringing,

varying vec2 vUv; // uv coords

// constants TODO should be const-qualified
vec2 texel = vec2(1.0/iResolution.x,1.0/iResolution.y);
float dbsize = 1.25; // depth blur size
const float CoC = 0.03; //circle of confusion size in mm (35mm film = 0.03mm)
const int rings = 3;
const int samples = 4;
const int maxringsamples = rings * samples;


// generating noise / pattern texture for dithering
vec2 rand(vec2 coord) {

	float noiseX = ((fract(1.0-coord.s*(iResolution.x/2.0))*0.25)+(fract(coord.t*(iResolution.y/2.0))*0.75))*2.0-1.0;
	float noiseY = ((fract(1.0-coord.s*(iResolution.x/2.0))*0.75)+(fract(coord.t*(iResolution.y/2.0))*0.25))*2.0-1.0;

	// if (noise) {
	// 	noiseX = clamp(fract(sin(dot(coord ,vec2(12.9898,78.233))) * 43758.5453),0.0,1.0)*2.0-1.0;
	// 	noiseY = clamp(fract(sin(dot(coord ,vec2(12.9898,78.233)*2.0)) * 43758.5453),0.0,1.0)*2.0-1.0;
	// }

	return vec2(noiseX,noiseY);
}

// Depth buffer blur
// calculate the depth from a given set of coordinates
float bdepth(vec2 coords) {
	float d = 0.0, kernel[9];
	vec2 offset[9], wh = vec2(texel.x, texel.y) * dbsize;

	offset[0] = vec2(-wh.x,-wh.y);
	offset[1] = vec2( 0.0, -wh.y);
	offset[2] = vec2( wh.x -wh.y);

	offset[3] = vec2(-wh.x,  0.0);
	offset[4] = vec2( 0.0,   0.0);
	offset[5] = vec2( wh.x,  0.0);

	offset[6] = vec2(-wh.x, wh.y);
	offset[7] = vec2( 0.0,  wh.y);
	offset[8] = vec2( wh.x, wh.y);

	kernel[0] = 1.0/16.0;   kernel[1] = 2.0/16.0;   kernel[2] = 1.0/16.0;
	kernel[3] = 2.0/16.0;   kernel[4] = 4.0/16.0;   kernel[5] = 2.0/16.0;
	kernel[6] = 1.0/16.0;   kernel[7] = 2.0/16.0;   kernel[8] = 1.0/16.0;


	for( int i=0; i<9; i++ ) {
		float tmp = texture2D(tDepth, coords + offset[i]).r;
		d += tmp * kernel[i];
	}

	return d;
}

// processing the sample
vec3 color(vec2 coords,float blur) {
	vec3 col = vec3(0.0);

	// read from the render buffer at an offset
	col.r = texture2D(tRender,coords + vec2(0.0,1.0)*texel*fringe*blur).r;
	col.g = texture2D(tRender,coords + vec2(-0.866,-0.5)*texel*fringe*blur).g;
	col.b = texture2D(tRender,coords + vec2(0.866,-0.5)*texel*fringe*blur).b;

	vec3 lumcoeff = vec3(0.299,0.587,0.114); // arbitrary numbers???
	float lum = dot(col.rgb, lumcoeff);
	float thresh = max((lum-threshold)*gain, 0.0);
	return col+mix(vec3(0.0),col,thresh*blur);
}

float gather(float i, float j, int ringsamples, inout vec3 col, float w, float h, float blur) {
	float rings2 = float(rings);
	float step = PI*2.0 / float(ringsamples);
	float pw = cos(j*step)*i;
	float ph = sin(j*step)*i;
	float p = 1.0;
	col += color(vUv.xy + vec2(pw*w,ph*h), blur) * mix(1.0, i/rings2, bias) * p;
	return 1.0 * mix(1.0, i /rings2, bias) * p;
}

float linearize(float depth) {
	return -zfar * znear / (depth * (zfar - znear) - zfar);
}

void main(void)
{
	float depth = linearize(bdepth(vUv.xy));

	float f = focalLength; // focal length in mm,
	float d = focalDepth*1000.0; // focal plane in mm,
	float o = depth*1000.0; // depth in mm,

	float a = (o*f)/(o-f);
	float b = (d*f)/(d-f);
	float c = (d-f)/(d*fstop*CoC);

	float blur = clamp(abs(a-b)*c,0.0,1.0);

	// calculation of pattern for dithering
	vec2 noise = rand(vUv.xy)*dithering*blur;

	// getting blur x and y step factor
	float w = (1.0/iResolution.x)*blur*maxblur+noise.x;
	float h = (1.0/iResolution.y)*blur*maxblur+noise.y;

	// calculation of final color,
	vec3 col = texture2D(tRender, vUv.xy).rgb;

	if ( blur >= 0.05 ) {
		float s = 1.0;
		int ringsamples;

		for (int i = 1; i <= rings; i++) {
			ringsamples = i * samples;

			for (int j = 0 ; j < maxringsamples ; j++) {
				if (j >= ringsamples) break;
				s += gather(float(i), float(j), ringsamples, col, w, h, blur);
			}
		}
		col /= s; //divide by sample count
	}

	gl_FragColor = vec4(col,1.0);
}