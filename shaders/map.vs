uniform sampler2D tElevation, tSatellite;
uniform vec2 iTexResolution;
uniform float heightIntensity;

varying vec2 vUv;
varying vec3 vertPos, vNormal, vTangent, vBinormal, vElev;

void main() {

	vUv = uv;

	// the elevation is already a normal map, yay!
	vec3 norm = normalize(texture2D(tElevation, vUv).rgb);

	vNormal = normalize( normalMatrix * norm );
	vTangent = normalize( normalMatrix * position );
	vBinormal = normalize( cross( norm, vTangent ) );

	// deform mesh by the distance from the edge
	gl_Position = projectionMatrix * modelViewMatrix * vec4( norm * normal + position, 1.0 );
	vertPos = (modelViewMatrix * vec4( norm * normal + position, 1.0)).xyz;
}