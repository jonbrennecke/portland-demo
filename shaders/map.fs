uniform sampler2D tElevation, tSatellite;

uniform vec3 pointLightColor[MAX_POINT_LIGHTS];
uniform vec3 pointLightPosition[MAX_POINT_LIGHTS];
uniform float pointLightIntensity[MAX_POINT_LIGHTS];

varying vec2 vUv;
varying vec3 vertPos, vNormal, vTangent, vBinormal, vElev;

const float specIntensity = 1.0;


void main() {

	vec4 color = texture2D(tSatellite,vUv);

	// convert the normal maps (in tangent-space) to eye-space
	vec3 tanNormal = normalize( (vTangent * vElev.x) + (vBinormal * vElev.y) + (vNormal * vElev.z) );

	vec4 sumLights = vec4(0.0,0.0,0.0,1.0);
	for( int i = 0; i < MAX_POINT_LIGHTS; ++i)
	{
		vec3 lightDir = normalize(pointLightPosition[i]-vertPos);
		vec3 reflectDir = reflect( -lightDir, tanNormal);
		vec3 viewDir = normalize( - vertPos );
		float lambertian = max( dot( lightDir, vNormal ), 0.1 );
		float specular;

		if( lambertian > 0.0 ) {
			float specAngle = max( dot( reflectDir, viewDir ), 0.01 );
			specular = pow(specAngle, 4.0);
		}

		sumLights.rgb += clamp(lambertian * color.xyz + specular * pointLightColor[i] * pointLightIntensity[i],0.0,1.0);
	}

	gl_FragColor = sumLights;

}