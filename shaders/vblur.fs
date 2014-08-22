varying vec2 vUv;
uniform sampler2D glomap;
uniform float blurSize;

void main(void) 
{

	vec4 sum = vec4(0.0);

	// blur in y (vertical)
	// take nine samples, with the distance blurSize between them
	sum += texture2D(glomap, vec2(vUv.x, vUv.y - 4.0*blurSize)) * 0.05;
	sum += texture2D(glomap, vec2(vUv.x, vUv.y - 3.0*blurSize)) * 0.09;
	sum += texture2D(glomap, vec2(vUv.x, vUv.y - 2.0*blurSize)) * 0.12;
	sum += texture2D(glomap, vec2(vUv.x, vUv.y - blurSize)) * 0.15;
	sum += texture2D(glomap, vec2(vUv.x, vUv.y)) * 0.16;
	sum += texture2D(glomap, vec2(vUv.x, vUv.y + blurSize)) * 0.15;
	sum += texture2D(glomap, vec2(vUv.x, vUv.y + 2.0*blurSize)) * 0.12;
	sum += texture2D(glomap, vec2(vUv.x, vUv.y + 3.0*blurSize)) * 0.09;
	sum += texture2D(glomap, vec2(vUv.x, vUv.y + 4.0*blurSize)) * 0.05;

	gl_FragColor = sum;
}