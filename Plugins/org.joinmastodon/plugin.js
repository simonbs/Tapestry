
// org.joinmastodon

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

function postForItem(item, date = null) {
	const account = item["account"];
	const displayName = account["display_name"]
	const accountName = (displayName ? displayName : ("@" + account["username"]));
	const creator = Creator.createWithUriName(account["url"], accountName);
	creator.avatar = account["avatar"];

	var postDate;
	if (date == null) {
		postDate = new Date(item["created_at"]);
	}
	else {
		postDate = date;
	}
	
	const uri = item["uri"];
	const content = item["content"];
	const post = Post.createWithUriDateContent(uri, postDate, content);
	post.creator = creator;

	var attachments = null;
	const mediaAttachments = item["media_attachments"];
	if (mediaAttachments != null) {
		attachments = []
		for (const mediaAttachment of mediaAttachments) {
			const media = mediaAttachment["url"]
			const attachment = Attachment.createWithMedia(media);
			attachment.thumbnail = mediaAttachment["preview_url"];
			attachment.text = mediaAttachment["description"];
			attachment.blurhash = mediaAttachment["blurhash"];
			attachments.push(attachment);
		}
	}
	post.attachments = attachments;

	return post;
}

function load() {
	sendRequest(site + "/api/v1/timelines/home?limit=40", "GET")
	.then((text) => {
		const jsonObject = JSON.parse(text);
		var results = [];
		for (const item of jsonObject) {
			const date = new Date(item["created_at"]);
			
			var postItem = item;
			if (item["reblog"] != null) {
				postItem = item["reblog"];
			}
			
			const post = postForItem(postItem, date);
			
			results.push(post);
		}
		processResults(results, true);
	})
	.catch((requestError) => {
		processError(requestError);
	});	

	sendRequest(site + "/api/v1/notifications?types%5B%5D=mention&limit=30", "GET")
	.then((text) => {
		const jsonObject = JSON.parse(text);
		var results = [];
		for (const item of jsonObject) {
			var postItem = item["status"];

			const post = postForItem(postItem);

			results.push(post);
		}
		processResults(results, true);
	})
	.catch((requestError) => {
		processError(requestError);
	});	
}

function sendPost(parameters) {
	sendRequest(site + "/api/v1/statuses", "POST", parameters)
	.then((text) => {
		const jsonObject = JSON.parse(text);
		processResults([jsonObject], true);
	})
	.catch((requestError) => {
		processError(requestError);
	});
}

function sendAttachments(post) {
	const mediaEndpoint = site + "/api/v2/media";
	
	const file = post.attachments[0].media;
	uploadFile(file, mediaEndpoint)
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		const mediaId = jsonObject["id"];
		
		const status = post.content;
		
		const parameters = "status=" + status + "&" + "media_ids[]=" + mediaId;
		
		sendPost(parameters);
	})
	.catch((requestError) => {
		processError(requestError);
	});
}

function send(post) {
	if (post.attachments != null && post.attachments.length > 0) {
		sendAttachments(post);
	}
	else {
		const status = post.content;
		const parameters = "status=" + status;
		
		sendPost(parameters);
	}
}

