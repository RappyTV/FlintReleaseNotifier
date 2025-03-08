import axios, { AxiosError } from "axios";
import Logger from "./libs/Logger";
import type { AddonChangeLog } from "./types/AddonChangeLog";
import { join } from "path";
import { config } from "./libs/config";
import { NotificationType } from "./types/NotificationType";
import { CronJob } from "cron";

const tz = 'Europe/Berlin';

const modCache = (modification: string) => Bun.file(join(__dirname, '..', '.cache', `${modification}.json`));
const mods = config.watchedMods.map((mod) => mod.toLowerCase());

async function getModVersions(modifications: string[]): Promise<{ [key: string]: string }> {
    return new Promise(async (resolve, reject) => {
        try {
            const result = await axios.post(`https://flintmc.net/api/client-store/proof-modification-versions/${config.labymodVersion}`, modifications);
            if(result.data instanceof Array) return resolve({});
            resolve(result.data);
        } catch(err) {
            reject('Failed to validate mod versions: ' + (err as AxiosError).message);
        }
    })
}

async function getModChangelog(modification: string): Promise<string[]> {
    return new Promise(async (resolve, reject) => {
        try {
            const result = await axios.get(`https://flintmc.net/api/client-store/get-modification-changelogs/${modification}?cache=${Date.now()}`, { 
                headers: {
                    'User-Agent': 'FlintReleaseNotifier: https://github.com/RappyTV/FlintReleaseNotifier; Contact: contact@rappytv.com'
                }
            });
            const changelog = result.data as AddonChangeLog;
    
            resolve(changelog.map((item) => item.release));
        } catch(err) {
            reject(`Failed to retrieve mod changelog of ${modification}: ` + (err as AxiosError).message);
        }
    });
}

function sendWebhook(modification: string, type: NotificationType, version: string) {
    if(config.webhook.url.trim().length == 0) return;
    const embed = {
        color: 2463422,
        title: type == NotificationType.Both ? 'New approved release' : type == NotificationType.Released ? 'New release' : 'Release approved',
        description: `The version \`v${version}\` of \`${modification}\` just got ${type == NotificationType.Both ? 'released and approved' : NotificationType[type].toLowerCase()}!`
    }

    axios.post(config.webhook.url, {
        content: config.webhook.content.trim().length > 0 ? config.webhook.content : undefined,
        embeds: [embed]
    });
}

async function checkForUpdates() {
    Logger.debug('Retrieving mod versions...');
    const versions = await getModVersions(mods).catch((error) => {
        Logger.error(error);
        return null;
    });
    if(!versions) return;

    for(const mod of mods) {
        const changelog = await getModChangelog(mod).catch((error) => {
            Logger.error(error);
            return null;
        });
        if(!changelog) continue;

        const cacheFile = modCache(mod);
        const latestVersion = changelog.at(-1)!;
        const releasedVersion = versions[mod];
        if(typeof releasedVersion == 'number') {
            Logger.warn(`Invalid state on ${mod}: ${releasedVersion}`);
            continue;
        } else if(releasedVersion == 'INVALIDATED') {
            Logger.warn(`${mod} is invalidated!`);
            continue;
        } else if(releasedVersion == 'DELETED') {
            Logger.error(`${mod} is deleted!`);
            continue;
        }
        const isReleased = latestVersion == releasedVersion;
        if(!await cacheFile.exists()) {
            Logger.info(`${mod} is not cached yet. Creating...`);
            Bun.write(cacheFile, JSON.stringify({ latestVersion, released: isReleased }));
            Logger.info(`${mod} was cached!`);
            continue;
        } else {
            const cache = JSON.parse(await cacheFile.text()) as { latestVersion: string, released: boolean };
            if(cache.latestVersion != latestVersion) {
                Logger.info(isReleased ? `${mod} has an update which got released instantly!` : `${mod} has an update!`);
                cache.latestVersion = latestVersion;
                cache.released = isReleased;
                Bun.write(cacheFile, JSON.stringify(cache));

                sendWebhook(mod, isReleased ? NotificationType.Both : NotificationType.Released, latestVersion);
            } else if(!cache.released && isReleased) {
                Logger.info(`${mod} has been released!`);
                cache.released = true;
                Bun.write(cacheFile, JSON.stringify(cache));

                sendWebhook(mod, NotificationType.Approved, latestVersion);
            } else {
                Logger.debug(`${mod} did not have any updates.`);
            }
        }
    }
    Logger.info('Update check complete.');
}

new CronJob(config.cron, checkForUpdates, null, true, tz, null, true);