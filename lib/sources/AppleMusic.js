"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const UnresolvedTrack_1 = __importDefault(require("../UnresolvedTrack"));
const undici_1 = require("undici");
class AppleMusic {
    vulkava;
    static RENEW_URL = 'https://music.apple.com/us/album/%C3%ADgneo/1604813268';
    static TOKEN_PAYLOAD_REGEX = /"desktop-music-app\/config\/environment" content="([^"]+)"/;
    token;
    renewDate;
    constructor(vulkava) {
        this.vulkava = vulkava;
        this.token = null;
        this.renewDate = 0;
    }
    async getMusicVideo(id, storefront) {
        const track = await this.makeRequest(`music-videos/${id}`, storefront);
        return this.buildTrack(track.data[0].attributes);
    }
    async getTrack(id, storefront) {
        const track = await this.makeRequest(`songs/${id}`, storefront);
        return this.buildTrack(track.data[0].attributes);
    }
    async getAlbum(id, storefront) {
        const unresolvedTracks = [];
        const res = await this.makeRequest(`albums/${id}`, storefront);
        const title = res.data[0].attributes.name;
        let next = res.data[0].relationships.tracks.next;
        for (const it of res.data[0].relationships.tracks.data) {
            unresolvedTracks.push(this.buildTrack(it.attributes));
        }
        while (next && unresolvedTracks.length < 400) {
            const nextRes = await this.makeRequest(next.split('/').slice(4).join('/'), storefront);
            next = nextRes.next;
            for (const it of nextRes.data) {
                unresolvedTracks.push(this.buildTrack(it.attributes));
            }
        }
        return { title, tracks: unresolvedTracks };
    }
    async getPlaylist(id, storefront) {
        const unresolvedTracks = [];
        const res = await this.makeRequest(`playlists/${id}`, storefront);
        const title = res.data[0].attributes.name;
        let next = res.data[0].relationships.tracks.next;
        for (const it of res.data[0].relationships.tracks.data) {
            unresolvedTracks.push(this.buildTrack(it.attributes));
        }
        while (next && unresolvedTracks.length < 400) {
            const nextRes = await this.makeRequest(next.split('/').slice(4).join('/'), storefront);
            next = nextRes.next;
            for (const it of nextRes.data) {
                unresolvedTracks.push(this.buildTrack(it.attributes));
            }
        }
        return { title, tracks: unresolvedTracks };
    }
    async getArtistTopTracks(id, storefront) {
        const artistRes = await this.makeRequest(`artists/${id}`, storefront);
        const unresolvedTracks = [];
        const res = await this.makeRequest(`artists/${id}/view/top-songs`, storefront);
        for (const it of res.data) {
            unresolvedTracks.push(this.buildTrack(it.attributes));
        }
        return {
            title: `${artistRes.data[0].attributes.name}'s top tracks`,
            tracks: unresolvedTracks
        };
    }
    buildTrack({ name, artistName, url, durationInMillis, isrc }) {
        return new UnresolvedTrack_1.default(this.vulkava, name, artistName, durationInMillis, url, 'apple-music', isrc);
    }
    async makeRequest(endpoint, storefront) {
        if (!this.token || this.renewDate === 0 || Date.now() > this.renewDate)
            await this.renewToken();
        return (0, undici_1.request)(`https://api.music.apple.com/v1/catalog/${storefront}/${endpoint}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.60 Safari/537.36',
                Authorization: `Bearer ${this.token}`,
                'Origin': 'https://music.apple.com'
            }
        }).then(r => r.body.json());
    }
    async renewToken() {
        const html = await (0, undici_1.request)(AppleMusic.RENEW_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.60 Safari/537.36'
            }
        }).then(r => r.body.text());
        const tokenPayloadMatch = html.match(AppleMusic.TOKEN_PAYLOAD_REGEX);
        if (!tokenPayloadMatch) {
            throw new Error('Could not get Apple Music token payload!');
        }
        const tokenPayload = JSON.parse(decodeURIComponent(tokenPayloadMatch[1]));
        const token = tokenPayload['MEDIA_API']?.token;
        if (!token) {
            throw new Error('Could not get Apple Music token!');
        }
        this.token = token;
        // 6 months but just in case ;)
        this.renewDate = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).exp * 1000;
    }
}
exports.default = AppleMusic;
