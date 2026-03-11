package com.tuempresa.hoopsai;

import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.util.Log;
import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.net.NetworkInterface;
import java.util.Collections;
import java.util.List;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // CIBERSEGURIDAD 2026: FLAG_SECURE
        // Bloquea capturas de pantalla, grabaciones de pantalla y visualización en multitarea.
        // Mitiga ataques de malware de "Screen Scraping" y acceso físico tras robo.
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);

        if (isDeviceRooted() || isEmulator() || isVpnActive()) {
            Log.e("SECURITY", "Entorno hostil o anonimato detectado.");
            // En una auditoría real, aquí reportaríamos a nuestro backend la anomalía (SIEM)
        }
    }

    @Override
    public void onStart() {
        super.onStart();
        WebView webView = this.bridge.getWebView();
        if (webView != null) {
            WebSettings settings = webView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            
            // DESACTIVAR ACCESO A ARCHIVOS (Anti-Data Leaking)
            settings.setAllowFileAccess(false);
            settings.setAllowContentAccess(false);
            
            // Bloqueo de Debugging en producción
            WebView.setWebContentsDebuggingEnabled(false);
        }
    }

    // Detección de VPN/Tor (Interfaces de red virtuales)
    private boolean isVpnActive() {
        try {
            List<NetworkInterface> interfaces = Collections.list(NetworkInterface.getNetworkInterfaces());
            for (NetworkInterface intf : interfaces) {
                if (intf.isUp() && (intf.getName().contains("tun") || intf.getName().contains("ppp") || intf.getName().contains("pptp"))) {
                    return true;
                }
            }
        } catch (Exception e) {
            return false;
        }
        return false;
    }

    private boolean isDeviceRooted() {
        String[] paths = { "/system/app/Superuser.apk", "/sbin/su", "/system/bin/su", "/system/xbin/su", "/data/local/xbin/su" };
        for (String path : paths) {
            if (new File(path).exists()) return true;
        }
        return false;
    }

    private boolean isEmulator() {
        return (android.os.Build.BRAND.startsWith("generic") && android.os.Build.DEVICE.startsWith("generic"))
                || android.os.Build.FINGERPRINT.startsWith("generic")
                || android.os.Build.FINGERPRINT.startsWith("unknown")
                || android.os.Build.HARDWARE.contains("goldfish")
                || android.os.Build.HARDWARE.contains("ranchu")
                || android.os.Build.MODEL.contains("google_sdk")
                || android.os.Build.MODEL.contains("Emulator")
                || android.os.Build.MODEL.contains("Android SDK built for x86");
    }
}
