package uy.kioskpuzzle.tests;

import static org.junit.Assert.*;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.view.WindowManager;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Ejecutar con connectedReleaseAndroidTest sobre una tablet/emulador conectado. */
@RunWith(AndroidJUnit4.class)
public class KioskActivityTest {
    @Test
    public void releaseIsOfflineAndKeepsScreenAwake() {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals(PackageManager.PERMISSION_DENIED,
            context.checkSelfPermission("android.permission.INTERNET"));
        assertEquals(0, context.getApplicationInfo().flags & ApplicationInfo.FLAG_ALLOW_BACKUP);
        assertEquals(0, context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE);
        Intent intent = new Intent().setClassName(context.getPackageName(),
            context.getPackageName() + ".MainActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try (ActivityScenario<Activity> scenario = ActivityScenario.launch(intent)) {
            scenario.onActivity(activity -> {
                assertTrue((activity.getWindow().getAttributes().flags
                    & WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) != 0);
                int initial = activity.getRequestedOrientation();
                assertTrue(initial == ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                    || initial == ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT);
                activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);
                assertEquals(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE,
                    activity.getRequestedOrientation());
                activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
                assertEquals(ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT,
                    activity.getRequestedOrientation());
                activity.setRequestedOrientation(initial);
            });
        }
    }
}
