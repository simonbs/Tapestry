
# Tapestry API

## Introduction

The following document describes the JavaScript API that Tapestry uses to process information from the Internet. The components shown below are used to create "connectors" that allow a timeline to be populated from a data source.

This is a work-in-progress and details are certain to change.

Note that JavaScript in plug-ins must conform to the [ECMA-262 specification](http://www.ecma-international.org/publications/standards/Ecma-262.htm). This specification defines the language and its basic [functions](https://262.ecma-international.org/14.0/#sec-function-properties-of-the-global-object) and [objects](https://262.ecma-international.org/14.0/#sec-constructor-properties-of-the-global-object). Additions that support the Document Object Model (DOM) and other browser functions are not available.

## Variables

Any variables that have been specified in `ui-config.json` are set before the script is executed. For example, the Mastodon plug-in specifies the following inputs:

```json
{
	"inputs": [
		{
			"name": "site",
			"type": "url",
			"prompt": "Instance",
			"validate_as": "url",
			"placeholder": "https://mastodon.social"
		}
	]
}
```

The current value for the `site` input will be set before the `plugin.js` script is executed. This lets the script adapt to use `mastodon.social`, `mastodon.art`, etc. with code such as this:

```javascript
sendRequest(site + "/api/v1/timelines/home?limit=40")
```

See the Configuration section below for the specification of `ui-config.json` and each input/variable.

## Objects

The following objects are used to create content for the app:


### Post

`Post` objects are used to populate a timeline in the app. One will also be used to add a new item to a service (and timeline). You create one with:

```javascript
const uri = "https://example.com/unique/path/to/content";
const date = Date();
const content = "This is <em>a contrived</em> example, but <b>so what?</b>".
const post = Post.createWithUriDateContent(uri, date, content);
```

#### uri: String (required)

A unique URI for the post on the Internet. Used to show details for the post.

#### date: Date (required)

The date and time when the post was created.

#### content: String (required)

Text with HTML formatting that will be displayed for the post.

#### creator: Creator

The creator of the content. See below.

#### attachments: Array of Attachment

Up to four media attachments for the content. See below.

_NOTE:_ Media attachments will be automatically created when inline images are used in the HTML of the `content` property unless the `providesAttachments` configuration parameter is set to true.

### Creator

A `Post` can have a creator that indicates how the content was created. It can be a person, a service, or a device. The information is used to present an avatar and header for the post in the timeline.

```javascript
const uri = "http://chocklock.com";
const name = "CHOCK OF THE LOCK";
const creator = Creator.createWithUriName(uri, name);
creator.avatar = "http://chocklock.com/favicon.ico";

post.creator = creator;
```

#### uri: String (required)

A unique URI for the creator on the Internet. Can be an individual’s account page, bot, or other type of creator. Will be used to show details for the creator.

#### name: String (required)

The name of the creator. Can be an account’s full name, a bot name, or anything to identify the data and source.

#### avatar: String

A string containing the URL for the creator’s avatar on the Internet. If no avatar is specified a generic image will be displayed in the timeline.


### Attachment

`Post`s can also have media attachments. Photos, videos, and audio are commonly available from APIs and other data sources, and this is how you get them into the timeline. They will be displayed under the HTML content.

```javascript
const attachment = Attachment.createWithMedia(media)
attachment.text = "Yet another cat on the Internet."

post.attachments = [attachment];
```

#### media: String (required)

A string containing the URL for the media on the Internet

#### thumbnail: String

A string containing the URL for a lower resolution copy of the media

#### text: String

A string that describes the media (for accessibility)

#### blurhash: String

A string that provides a placeholder image.


## Actions

The app will call the following functions in `plugin.js` when it needs the script to read or write data. If no implementation is provided, no action will be performed. For example, a read-only feed does not need to specify `send(post)`.

All actions are performed asynchronously (using one or more JavaScript Promise objects). An action indicates that it has completed using the `processResults`, `processError`, and `setIdentifier` functions specified below.

### identify()

Determines the identity for the user and site. After `setIdentifier` is called with a String, it will displayed in the app when configuring the timeline. For example, "Mastodon (chockenberry)" allows a user to differentiate between separate accounts.

This function will only be called if `needsVerification` is set to true in the plug-in’s configuration.

### load()

Loads any new data and return it to the app with `processResults` or `processError`. Variables can be used to determine what to load. For example, whether to include mentions on Mastodon or not.

### send(post)

Use the supplied `Post` object to send data to a service. The `post.attachments` will contain a string URL in media and a description (if available): these attachments can be uploaded to a media endpoint using `uploadFile` before posting. 

This function will only be called if `canPost` is set to true in the plug-in’s configuration.

## Functions

The following functions are available to the script to help it perform the actions listed above.

### sendRequest(url, method, parameters, extraHeaders) → Promise

Sends a request. If configured, a bearer token will be included with the request automatically.

  * url: `String` with the endpoint that will be retrieved.
  * method: `String` with the HTTP method for the request (default is "GET").
  * parameters: `String` with the parameters for HTML body of "POST" or "PUT" request. For example: "foo=1&bar=something" (default is null).
  * extraHeaders: `Dictionary` of `String` key/value pairs. They will be added to the request (default is null for no extra headers).

Returns a `Promise` with a resolve handler with a String parameter and a reject handler with an Error parameter. The resolve handler’s string is:

_NOTE:_ The `url` is assumed to be properly encoded. Use JavaScript’s `encodeURI`, if needed.

  * For "HEAD" method, the string result contains a JSON dictionary:
  
```json
{
	"status": 404,
	"headers": {
		"last-modified": "Thu, 02 Mar 2023 21:46:29 GMT",
		"content-length": "15287",
		"...": "..."
	}
}
```

  * For all other successful requests, the string contains the response body. Typically this will be HTML text or a JSON payload. Regular expressions can be used on HTML and `JSON.parse` can be used to build queryable object. In both cases, the data extracted will be returned to the app.
  
#### EXAMPLE

A Mastodon user’s identity is determined by sending a request to verify credentials:

```javascript
function identify() {
	sendRequest(site + "/api/v1/accounts/verify_credentials")
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		const identifier = jsonObject["username"];
		setIdentifier(identifier);
	})
	.catch((requestError) => {
		processError(requestError);
	});
}
```

_NOTE:_ The JavaScript code doesn’t have access to the bearer token (for security, no authentication information is exposed to the plug-in). If a bearer token is needed in a list of `parameters`, use `__bearerToken__` — it will be substituted before the request is sent to the endpoint.


### processResults(results, complete)

Sends any data that’s retrieved to the app for display.

  * results: `Array` with `Post` or `Creator` objects.
  * complete: `Boolean` with a flag that indicates that result collection is complete and can be displayed in the app timeline (default is true).


### processError(error)

Sends any error to the app for display

  * error: `Error` which indicates what went wrong. Will be displayed in the user interface.

### setIdentifier(identifier)

Sets the identity for the site and service.

  * identifier: `String` or dictionary `Object` which helps user to identify the account being used.
  
_NOTE:_ When using a dictionary, an `identifier` for the site name and a `baseUrl` for media (which is different than the site) should be supplied. A dictionary is typically used for feeds where the site is "feed.example.com" but images and other resources are loaded from "example.com".
  
### uploadFile(file, mediaEndpoint) → Promise

  * file: `String` is the name retrieved from `post.attachments.media`. Do not modify this value, which points to a temporary file that will be used for the upload.
  * mediaEndpoint: `String` is the URL where multipart/form-data content will be delivered.

### xmlParse(text) → Object

  * text: `String` is the text representation of the XML data.
  
Returns an `Object` representation of the XML data, much like `JSON.parse` does.

_NOTE:_ Do not assume that the order of the keys in the object dictionaries will be the same as they occurred in the XML. No order is preserved during processing (as is the case with JSON parsing).

To deal with the differences between XML and JavaScript objects (JSON), some processing is done on the XML.

If the XML has multiple nodes with the same name, they are put into an array. For example, the following XML:

```xml
<root>
	<metadata>Example</metadata>
	<entry>
		<title>First</title>
	</entry>
	<entry>
		<title>Second</title>
	</entry>
</root>		
```

Will generate:

```json
{
	"root": {
		"metadata": "Example",
		"entry": [
			{
				"title": "First"
			},
			{
				"title": "Second"
			}
		]
	}
}
```

When evaluating the result, you can use JavaScript’s `instanceof` operator. Using the example above, `object.root.entry instanceof Array` will return true, while `object.root instanceof Array` will return false. You can also use `Object`’s `.getOwnPropertyNames(object)` to get a list of properties generated for the node: in the example above, the properties of `object.root` are `[metadata,entry]`.

A node’s attributes are stored in a sibling object with a "$attrs" key. The dollar sign was chosen because it’s an invalid XML node name, but is a valid JavaScript property name. This makes it easy to access with a path like `object.root.node$attrs`.

For example, this XML:

```xml
<root>
	<node first="1" second="2" third="3">value</node>
</root>
```

Produces:

```json
{
	"root" : {
		"node" : "value",
		"node$attrs" : {
			"first" : "1",
			"second" : "2",
			"third" : "3"
		}
	}
}
```

Note that these two processing steps can be combined in some cases. An example is multiple link nodes with nothing but attributes:

```xml
<root>
	<link first="abc" second="def" />
	<link first="hij" second="klm" />
</root>
```

Will only produce attribute dictionaries:
 
```json
{
	"root" : {
		"link$attrs" : [
			{
				"first" : "abc",
				"second" : "def"
			},
			{
				"first" : "hij",
				"second" : "klm"
			}
		]
	}
}
```

Note also that text that’s not a part of a node will be ignored. For example:

```xml
<root>
	text
	<node>value</node>
</root>
```

Results:

```json
{
	"root" : {
		"node" : "value"
	}
}
```

Finally, not all XML nodes will be accessible with a object property path. An XML node with a namespace will be represented as `namespace:key` and that’s an invalid identifier in JavaScript. You will need to access these values using the index operator instead: `object["namespace.key"]`.

This functionality should be enough to parse XML generated from hierarchical data, such as an RSS feed generated by a WordPress database of posts.

## Configuration

Each connector plug-in is defined using three files: `plugin-config.json`, `plugin.js`, and `ui-config.json`. The contents of each of thise files is discussed below:

### plugin-config.json

Required properties:

  * id: `String` with reverse domain name for uniqueness (e.g. org.joinmastodon or blog.micro)
  * displayName: `String` with name that will be displayed in user interface

Optional properties:

  * register: `String` with endpoint to register app (e.g. "/api/v1/apps").
  * oauth\_authorize: `String` with endpoint to authorize account (e.g. "/oauth/authorize").
  * oauth\_token: `String` with endpoint to get bearer token (e.g. "/oauth/token").
  * oauth\_type: `String` with response type parameter (currently, only "code" is supported).
  * oauth\_code\_key: `String` with code result from authorize endpoint (e.g "code").
  * oauth\_scope: `String` with scope used to register and get token (e.g. "read+write+push").
  * oauth\_grant\_type: `String` with grant type (currently, only "authorization_code" is supported).
  * oauth\_http\_redirect: `Boolean`, with true, the OAuth redirect URI will be "https://iconfactory.com/muxer", otherwise "muxer://oauth" is used.
  * jwt\_authorize: `String` with endpoint to authorize account (e.g. "/xrpc/createSession").
  * jwt\_refresh: `String` with endpoint to refresh account (e.g. "/xrpc/refreshSession").
  * needs\_verification: `Boolean` with true if verification is needed (by calling `identify()`)
  * can\_post: `Boolean` with true if connector can post.
  * provides\_attachments: `Boolean` with true if connector generates attachments, otherwise post-processing of HTML content will be used to capture images & video.
  * check\_interval: `Number` with number of seconds between load requests (currently unimplemented).
 
_NOTE:_ The oauth\_authorize, oauth\_token, jwt\_authorize, and jwt\_refresh endpoints can be relative or absolute URLs. Relative paths use the `site` variable in `ui-config.json` as a base (allowing a single connector to support multiple federated servers, like with Mastodon). Absolute paths allow different domains to be used for the initial authorize and token generation (as with Tumblr).

#### EXAMPLES

The configuration for the Mastodon connector is:

```json
{
	"id": "org.joinmastodon",
	"display_name": "Mastodon",
	"register": "/api/v1/apps",
	"oauth_authorize": "/oauth/authorize",
	"oauth_token": "/oauth/token",
	"oauth_type": "code",
	"oauth_code_key": "code",
	"oauth_scope": "read+write+push",
	"oauth_grant_type": "authorization_code",
	"providesAttachments": true,
	"canPost": true,
	"check_interval": 300
}
```

The configuration for the JSON Feed connector is:

```json
{
	"id": "org.jsonfeed",
	"display_name": "JSON Feed",
	"needsVerification": true,
	"check_interval": 300
}
```
 
### ui-config.json

The user interface in the app is configured with this file. A connector plug-in can have any number of inputs, specified as an `Array`. Each input has the these required properties:

  * name: `String` with the name of the input. This value is used to generate variables for `plugin.js`.
  * type: `String` with the type of input (currently, everything is a `String` value).
  * prompt: `String` with the name displayed in the user interface.

And these optional properties:

  * validate\_as: `String` with a validation type (currently unimplemented).
  * placeholder: `String` with a placeholder value for the user interface.
  * value: `String` with a default value.

#### EXAMPLES

The user interface configuration for the Mastodon connector is:

```json
{
	"inputs": [
		{
			"name": "site",
			"type": "url",
			"prompt": "Instance",
			"validate_as": "url",
			"placeholder": "https://mastodon.social"
		}
	]
}
```

The user interface configuration for the JSON Feed connector is:

```json
{
	"inputs": [
		{
			"name": "site",
			"type": "url",
			"prompt": "Feed URL",
			"validate_as": "url",
			"placeholder": "https://foo.com/feed.json"
		}
	]
}
```

### plugin.js

A JavaScript file that implements the Actions specified above using the Functions listed above. This is the file that pulls all the pieces described above into code that gets data and transforms it for use in the universal timeline.

The following `plugin.js` script is used in a connector that retrieves all recent earthquakes from the U.S. Geological Survey (USGS). This is all that's needed to create posts for the universal timeline:

```javascript
function load() {
	const endpoint = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson";
	sendRequest(endpoint)
	.then((text) => {
		const jsonObject = JSON.parse(text);

		const creatorUrl = "https://earthquake.usgs.gov/";
		const creatorName = "USGS – Latest Earthquakes";
		let creator = Creator.createWithUriName(creatorUrl, creatorName);
		creator.avatar = "https://earthquake.usgs.gov/earthquakes/map/assets/pwa/icon-192x192.png";

		const features = jsonObject["features"];
		
		let results = [];
		for (const feature of features) {
			const properties = feature["properties"];
			const url = properties["url"];
			const date = new Date(properties["time"]);
			const text = properties["title"];
			
			const geometry = feature["geometry"];
			const coordinates = geometry["coordinates"];
			const latitude = coordinates[1];
			const longitude = coordinates[0];
			const mapsUrl = "http://maps.apple.com/?ll=" + latitude + "," + longitude + "&spn=15.0";
			
			const content = "<p>" + text + " <a href=\"" + mapsUrl + "\">Open Map</a><p>"
			
			let post = Post.createWithUriDateContent(url, date, content);
			post.creator = creator;
			
			results.push(post);
		}
		processResults(results);
	})
	.catch((requestError) => {
		processError(requestError);
	});
}
```

This connector took about an hour to write with no prior knowledge of the API or data formats involved. All of the connectors in the current version of the app range in length from about 50 to 200 lines of code (including comments).

