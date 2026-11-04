package fr.mbonnici.portfolio.contact;

import fr.mbonnici.portfolio.config.AppProperties;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import tools.jackson.databind.ObjectMapper;

/**
 * Tells the owner a message arrived, outside the back office: an e-mail (Reply-To = the visitor, so
 * "Reply" just works) and/or a push through a webhook (ntfy, Discord, Slack or any JSON endpoint).
 * Both are optional and run off the request thread: a broken SMTP server never fails the form.
 */
@Component
public class ContactNotifier {

    private static final Logger log = LoggerFactory.getLogger(ContactNotifier.class);

    private final AppProperties.Notify config;
    private final JavaMailSenderImpl mail;
    private final ObjectMapper mapper;
    private final String siteUrl;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    public ContactNotifier(AppProperties props, ObjectMapper mapper) {
        this.config = props.notifications() == null
                ? new AppProperties.Notify("", "", "", "", 587, "", "", true)
                : props.notifications();
        this.mail = StringUtils.hasText(config.smtpHost()) ? sender(config) : null;
        this.mapper = mapper;
        this.siteUrl = props.url();
    }

    public boolean emailEnabled() {
        return StringUtils.hasText(config.email()) && mail != null;
    }

    public boolean webhookEnabled() {
        return StringUtils.hasText(config.webhookUrl());
    }

    public void messageReceived(ContactMessage m) {
        if (!emailEnabled() && !webhookEnabled()) {
            return;
        }
        Thread.ofVirtual().name("contact-notify").start(() -> {
            if (emailEnabled()) {
                sendEmail(m);
            }
            if (webhookEnabled()) {
                sendWebhook(m);
            }
        });
    }

    private void sendEmail(ContactMessage m) {
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setTo(config.email().split("\\s*,\\s*"));
            msg.setFrom(StringUtils.hasText(config.from()) ? config.from() : config.email());
            msg.setReplyTo(m.getEmail());
            msg.setSubject("[mbonnici.fr] Nouveau message de " + oneLine(m.getName()));
            msg.setText("""
                    %s <%s> vous a écrit depuis le formulaire de contact (%s) :

                    %s

                    —
                    Répondre : répondez simplement à cet e-mail.
                    Back office : %s/admin/messages
                    """.formatted(oneLine(m.getName()), m.getEmail(), m.getLocale() == null ? "fr" : m.getLocale(),
                    m.getMessage(), siteUrl));
            mail.send(msg);
            log.info("Contact notification e-mailed");
        } catch (Exception e) {
            log.warn("Contact e-mail notification failed: {}", e.getMessage());
        }
    }

    private void sendWebhook(ContactMessage m) {
        String url = config.webhookUrl();
        try {
            String title = "Nouveau message de " + oneLine(m.getName());
            String text = m.getMessage().length() > 1500 ? m.getMessage().substring(0, 1500) + "…" : m.getMessage();
            HttpRequest.Builder req = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(10));
            if (url.contains("ntfy")) {
                // ntfy: plain text body, metadata in headers (ASCII only, hence the RFC 2047 title)
                req.header("Title", "=?UTF-8?B?" + java.util.Base64.getEncoder()
                                .encodeToString(title.getBytes(StandardCharsets.UTF_8)) + "?=")
                        .header("Tags", "email")
                        .header("Click", siteUrl + "/admin/messages")
                        .POST(HttpRequest.BodyPublishers.ofString(m.getEmail() + "\n\n" + text, StandardCharsets.UTF_8));
            } else {
                Map<String, Object> body = new LinkedHashMap<>();
                String summary = "**" + title + "** (" + m.getEmail() + ")\n" + text;
                if (url.contains("discord")) {
                    body.put("content", summary.length() > 1900 ? summary.substring(0, 1900) + "…" : summary);
                } else {
                    body.put("text", summary);
                    body.put("name", m.getName());
                    body.put("email", m.getEmail());
                    body.put("message", m.getMessage());
                }
                req.header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofByteArray(mapper.writeValueAsBytes(body)));
            }
            HttpResponse<Void> res = http.send(req.build(), HttpResponse.BodyHandlers.discarding());
            if (res.statusCode() >= 300) {
                log.warn("Contact webhook answered {}", res.statusCode());
            }
        } catch (Exception e) {
            log.warn("Contact webhook notification failed: {}", e.getMessage());
        }
    }

    private static JavaMailSenderImpl sender(AppProperties.Notify c) {
        JavaMailSenderImpl s = new JavaMailSenderImpl();
        s.setHost(c.smtpHost());
        s.setPort(c.smtpPort());
        s.setDefaultEncoding("UTF-8");
        if (StringUtils.hasText(c.smtpUsername())) {
            s.setUsername(c.smtpUsername());
            s.setPassword(c.smtpPassword());
        }
        var p = s.getJavaMailProperties();
        p.put("mail.smtp.auth", String.valueOf(StringUtils.hasText(c.smtpUsername())));
        p.put("mail.smtp.starttls.enable", String.valueOf(c.smtpStarttls()));
        p.put("mail.smtp.ssl.enable", String.valueOf(c.smtpPort() == 465));
        p.put("mail.smtp.connectiontimeout", "10000");
        p.put("mail.smtp.timeout", "10000");
        p.put("mail.smtp.writetimeout", "10000");
        return s;
    }

    private static String oneLine(String s) {
        return s.replaceAll("[\\r\\n]+", " ").trim();
    }
}
