package online.andcoffee.app;

import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            registerPlugin(HealthConnectPlugin.class);
        }
        super.onCreate(savedInstanceState);
    }
}
