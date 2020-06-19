import { GuildSettings } from "../../lib/types/settings/GuildSettings";
import { UserSettings } from "../../lib/types/settings/UserSettings";
import { Task } from "klasa";
import { Embed } from "@klasa/core";
import { randomColor, displayAvatarURL, sendMessage } from "../../lib/utils/klasa";
import { Quran } from "../../quran";

export default class extends Task {
  async run() {
    this.client.emit("log", "Reminder Task Running");

    for (const guild of this.client.guilds.values()) {
      const userIDs = guild.settings.get(GuildSettings.FinishMonthlyUserIDs) as string[];
      if (!userIDs.length) continue;

      const channelID = guild.settings.get(GuildSettings.FinishMonthlyChannelID) as string | undefined;
      if (!channelID) continue;

      for (const id of userIDs) {
        const member = await guild.members.fetch(id).catch(() => null);
        if (!member?.user) continue;

        await member.user.settings.sync();
        // For each member get the status and verse of their quran reminders
        const [enabled, nextVerse] = member.user.settings.pluck(
          UserSettings.FinishMonthlyEnabled,
          UserSettings.FinishMonthlyVerse
        ) as [boolean, number];

        if (!enabled) continue;

        // Create the embed to send
        const embed = new Embed()
          .setColor(randomColor())
          .setAuthor(`Finish Quran Every Month Reminder!`, displayAvatarURL(member.user))
          .setTimestamp()
          .setFooter("Credits To Quran.com");

        // Get the surah and ayah numbers to send based on the verse they are up to
        let verse = nextVerse || 1;

        for (let i = 0; i < 3; i++) {
          let surah;
          let ayah = "ayah_1";

          for (const surahKey of Object.keys(Quran)) {
            const surahValue = Quran[surahKey];
            for (const ayahKey of Object.keys(surahValue)) {
              if (surahValue[ayahKey].verse !== verse) continue;
              surah = surahValue;
              ayah = ayahKey;
              break;
            }
            if (surah) break;
          }

          // Get the ayah object
          const ayahToSend = surah[ayah];
          // Add the ayah to the embed
          embed.addField(`Surah ${surah.name} Ayah #${ayah.substring(5)}`, ayahToSend.text);

          // Log it
          this.client.emit("log", `Reminded ${member.user.tag} of ${surah.name} ${ayah} in the reminder task.`);
          // Increase the counter
          verse++;
        }

        // Send the reminder embed for the verse
        const [sentReminder] = await sendMessage(channelID, {
          content: member.user.toString(),
          embed,
          allowed_mentions: { parse: [], users: [member.user.id], roles: [] },
        })
        // Add a reaction so the user can confirm they read it
        if (sentReminder) await sentReminder.reactions.add("✅");
        // Add 1 to the verse number or reset it if they are complete
        await member.user.settings.update(UserSettings.FinishMonthlyVerse, verse === 6105 ? 1 : verse);
      }
    }

    return;
  }
}
