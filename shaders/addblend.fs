varying vec2 vUv;
uniform sampler2D tSource1;
uniform sampler2D tSource2;
uniform vec2 iResolution;
uniform float iGlobalTime;

const float smoothness = 5.0; // lower numbers generate more smoothness
const float rate = 0.01; 
const float offset = 0.0; // offset from center
const float clouds = 10.0; // size of clouds, large numbers are smaller clouds
const vec3 s = vec3(1e0, 1e2, 1e3); // ?

// based off https://www.shadertoy.com/view/lsf3RH by Trisomie21

float snoise(vec3 uv, float res)
{
	uv *= res;
	vec3 uv0 = floor(mod(uv, res))*s;
	vec3 uv1 = floor(mod(uv+vec3(1.), res))*s;
	vec3 f = fract(uv); f = f*f*(3.0-2.0*f);
	vec4 v = vec4(uv0.x+uv0.y+uv0.z, uv1.x+uv0.y+uv0.z, uv0.x+uv1.y+uv0.z, uv1.x+uv1.y+uv0.z);
	vec4 r = fract(sin(v*1e-1)*1e3);
	float r0 = mix(mix(r.x, r.y, f.x), mix(r.z, r.w, f.x), f.y);
	r = fract(sin((v + uv1.z - uv0.z)*1e-1)*1e3);
	float r1 = mix(mix(r.x, r.y, f.x), mix(r.z, r.w, f.x), f.y);
	
	return mix(r0, r1, f.z)*2.-1.;
}

void main(void) 
{
	// vec4 t1 = texture2D(tSource1,vUv);
	// vec4 t2 = texture2D(tSource2, vUv );

	vec2 p = -.5 + gl_FragCoord.xy / iResolution.xy; // center
	p.x *= iResolution.x/iResolution.y;
	float color = 3.0 - (3.*length(2.*p));
	
	vec3 coord = vec3(atan(p.x,p.y)/6.2832+.5, length(p)*.4, .5); // radial noise
	// vec3 coord = vec3(vUv,0.5); // horizontal noise
	
	for(int i = 1; i <= 7; i++)
	{
		float power = pow(2.0, float(i));
		color += (smoothness/power) * snoise(coord + vec3(offset,-iGlobalTime*rate, iGlobalTime*rate), power*clouds);
	}

	// vec4 t1 = texture2D(tSource1,vUv);
	// vec4 t2 = texture2D(tSource2, vUv );

	gl_FragColor = texture2D(tSource2,vUv);
	// gl_FragColor = vec4( color, pow(max(color,0.),2.)*0.4, pow(max(color,0.),3.)*0.15 , 1.0);
	// gl_FragColor = viewMatrix * (t2 - ( 0.25 * color ));
	// gl_FragColor = t1;
}