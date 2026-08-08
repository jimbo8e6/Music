import { BackButton } from "@/components/BackButton";
import { getUserPreferences } from "@/lib/queries";
import { SettingsForm } from "./SettingsForm";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const prefs = await getUserPreferences();

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <BackButton />
      <h1 className="text-xl font-semibold">Settings</h1>
      <SettingsForm
        defaultLibrarySort={prefs.defaultLibrarySort}
        defaultCollectionSort={prefs.defaultCollectionSort}
      />
    </div>
  );
}
